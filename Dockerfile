# mtel-skill-registry — MCP resolver (Streamable HTTP)
#
# npm workspaces: the root package-lock.json resolves deps for both the
# `resolver` and `scripts` workspaces, so installs happen at the root.

FROM node:22-alpine AS build
WORKDIR /app

# Manifests first so `npm ci` is cached independently of source changes.
COPY package.json package-lock.json ./
COPY resolver/package.json resolver/
COPY scripts/package.json scripts/
RUN npm ci

COPY . .

# Regenerate index.json / bundle.json / public/r from skills/ so the image can
# never ship a catalog that is stale relative to the committed SKILL.md files.
RUN npm run build

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
COPY resolver/package.json resolver/
COPY scripts/package.json scripts/
RUN npm ci --omit=dev && npm cache clean --force

# Only the artifacts the resolver reads at runtime.
COPY --from=build /app/resolver ./resolver
# http.js reads docs/_style.html + the *-setup.html pages at boot.
COPY --from=build /app/docs ./docs
COPY --from=build /app/public ./public
COPY --from=build /app/skills ./skills
COPY --from=build /app/index.json ./index.json
COPY --from=build /app/bundle.json ./bundle.json

EXPOSE 3000
USER node

CMD ["node", "resolver/http.js"]
