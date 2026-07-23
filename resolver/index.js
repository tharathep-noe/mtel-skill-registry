/**
 * resolve_skills MCP server — stdio entry point.
 *
 * Each client (Claude Code, Codex) spawns this process locally and talks to it
 * over stdio. For a single central server that many projects connect to over
 * the network, use the Streamable HTTP entry point instead (http.js).
 *
 * The tool definition and matching logic live in server.js (createServer).
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { createServer } from "./server.js"

const server = createServer()
const transport = new StdioServerTransport()
await server.connect(transport)
