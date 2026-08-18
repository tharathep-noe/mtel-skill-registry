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

# Only the artifacts the resolver reads at runtime.
COPY resolver ./resolver
# http.js reads docs/_style.html + the *-setup.html pages at boot.
COPY docs ./docs
COPY public ./public
COPY skills ./skills
COPY index.json ./index.json
COPY bundle.json ./bundle.json

# Documentation only — compose publishes the port explicitly. Kept in sync with
# the resolver's default so it does not go stale when CONTAINER_PORT is changed.
ARG PORT=3000
EXPOSE ${PORT}
USER node

CMD ["node", "resolver/http.js"]
