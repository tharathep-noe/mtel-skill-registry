# mtel-skill-registry — MCP resolver (Streamable HTTP)
#
# Single stage on purpose. index.json, bundle.json and public/r/ are committed
# to the repo (see .gitignore), so the image does not need to run the `scripts`
# build — it only needs the resolver's runtime deps (express + MCP SDK).

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app

# npm workspaces: the root lockfile resolves deps for every workspace, so all
# workspace manifests must be present for `npm ci` to validate against it.
COPY package.json package-lock.json ./
COPY resolver/package.json resolver/
COPY scripts/package.json scripts/
RUN npm ci --omit=dev && npm cache clean --force

# Only what the resolver reads at runtime. docs/ is required: http.js reads
# docs/_style.html and the *-setup.html pages at module load, so omitting it
# crashes the server on boot with ENOENT.
COPY resolver/ resolver/
COPY public/ public/
COPY skills/ skills/
COPY docs/ docs/
COPY index.json bundle.json ./

EXPOSE 3000
USER node

CMD ["node", "resolver/http.js"]
