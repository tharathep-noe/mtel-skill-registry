/**
 * resolve_skills MCP server — Streamable HTTP entry point.
 *
 * Deploy this once as a central server; many projects (Claude Code, Codex)
 * connect to the same URL instead of each spawning a local stdio process.
 *
 * Stateless: the resolver holds no per-session state, so a fresh MCP Server +
 * transport is created per request (sessionIdGenerator: undefined). This keeps
 * the deployment horizontally scalable — any instance can serve any request.
 *
 * Env:
 *   PORT        — port to listen on (default 3000)
 *   MCP_AUTH_TOKEN — if set, requests must send `Authorization: Bearer <token>`
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "./server.js";

// Setup docs are served as HTML. Each page has a `<!--#style-->` placeholder
// that we replace with the shared stylesheet at load time (read once at boot).
const readDoc = (file) =>
  readFileSync(fileURLToPath(new URL(`../docs/${file}`, import.meta.url)), "utf8");

const SHARED_STYLE = readDoc("_style.html");
const SETUP_PAGES = {
  "/claude-setup": readDoc("claude-setup.html"),
  "/opencode-setup": readDoc("opencode-setup.html"),
  "/codex-setup": readDoc("codex-setup.html"),
};
for (const path of Object.keys(SETUP_PAGES)) {
  SETUP_PAGES[path] = SETUP_PAGES[path].replace("<!--#style-->", SHARED_STYLE);
}

// The skill bundle (metadata + full skill bodies) is a static catalog clients
// fetch to write .claude/skills/ without cloning the registry. Read once at
// boot; if it hasn't been generated (`npm run build` in scripts/), the route
// 404s rather than crashing the server.
const BUNDLE_PATH = fileURLToPath(new URL("../bundle.json", import.meta.url));
let BUNDLE = null;
try {
  BUNDLE = readFileSync(BUNDLE_PATH, "utf8");
} catch {
  console.warn(
    "bundle.json not found — /bundle.json will 404 until you run `npm run build` in scripts/",
  );
}

const PORT = Number(process.env.PORT) || 3000;
const AUTH_TOKEN = process.env.MCP_AUTH_TOKEN || null;
const MCP_PATH = "/mcp";
const BUNDLE_ROUTE = "/bundle.json";

const app = express();
app.use(express.json());

// Optional bearer-token gate. Applies to the MCP endpoint and to the bundle
// (which carries full skill content) — the landing page, setup docs, and
// health check stay open.
if (AUTH_TOKEN) {
  const requireAuth = (req, res, next) => {
    const header = req.headers.authorization || "";
    if (header !== `Bearer ${AUTH_TOKEN}`) {
      return res.status(401).json({
        jsonrpc: "2.0",
        error: { code: -32001, message: "Unauthorized" },
        id: null,
      });
    }
    next();
  };
  app.use(MCP_PATH, requireAuth);
  app.use(BUNDLE_ROUTE, requireAuth);
}

// Landing page: point visitors at the MCP endpoint and per-client setup docs
// rather than a placeholder. Built once at boot from the known routes.
const LANDING_PAGE = [
  "<!--#style-->",
  "<h1>mtel-skill-resolver</h1>",
  `<p>MCP endpoint: <code>POST ${MCP_PATH}</code></p>`,
  "<h2>Setup guides</h2>",
  "<ul>",
  ...Object.keys(SETUP_PAGES).map(
    (p) => `<li><a href="${p}">${p.replace(/^\/|-setup$/g, "")}</a></li>`
  ),
  "</ul>",
  `<p>Skill catalog: <a href="${BUNDLE_ROUTE}"><code>${BUNDLE_ROUTE}</code></a></p>`,
  '<p><a href="/health">Health check</a></p>',
].join("\n").replace("<!--#style-->", SHARED_STYLE);

app.get("/", (_req, res) => {
  res.type("html").send(LANDING_PAGE);
});

// Static skill catalog. Served raw (it is already valid JSON) so clients can
// fetch the whole catalog in one request and pick skills to write locally.
app.get(BUNDLE_ROUTE, (_req, res) => {
  if (!BUNDLE) {
    return res.status(404).json({
      error: "bundle.json not generated — run `npm run build` in scripts/",
    });
  }
  res.type("application/json").send(BUNDLE);
});

for (const [path, html] of Object.entries(SETUP_PAGES)) {
  app.get(path, (_req, res) => {
    res.type("html").send(html);
  });
}

app.get("/health", (_req, res) => {
  res.json({ status: "ok", server: "mtel-skill-resolver" });
});

// Streamable HTTP: one fresh server+transport per request (stateless mode).
app.post(MCP_PATH, async (req, res) => {
  const server = createServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  res.on("close", () => {
    transport.close();
    server.close();
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("Error handling MCP request:", err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

// Stateless mode has no server-initiated SSE stream or session to tear down.
const methodNotAllowed = (_req, res) => {
  res.status(405).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed." },
    id: null,
  });
};
app.get(MCP_PATH, methodNotAllowed);
app.delete(MCP_PATH, methodNotAllowed);

app.listen(PORT, () => {
  console.log(
    `mtel-skill-resolver (Streamable HTTP) listening on http://localhost:${PORT}${MCP_PATH}`,
  );
  console.log(`Health check: http://localhost:${PORT}/health`);
  if (AUTH_TOKEN) console.log("Bearer-token auth: enabled");
});
