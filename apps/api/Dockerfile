# syntax=docker/dockerfile:1
#
# apps/api runtime image.
#
# Build context is the repo root (see compose.yaml), because this is an npm
# workspaces monorepo: the API needs the root package.json/package-lock.json
# plus packages/shared, not just its own directory.
#
# The API runs its TypeScript sources directly with tsx (see apps/api/README.md
# and package.json's "start" script) rather than compiling to JS first, so the
# devDependencies list is installed as-is instead of pruning it down — the
# simplest correct thing, at the cost of a few unused dev tools (typescript,
# vite, vitest, @types/*) staying in the image alongside tsx.
FROM node:24.18.0-slim

WORKDIR /app

# Copy only the package manifests needed to resolve the workspace first, so
# `npm ci` is cached independently of source changes. apps/web is not part of
# this workspace install: its manifest is intentionally not copied and it is
# excluded from the build context by .dockerignore.
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api/package.json apps/api/package.json

RUN npm ci

COPY packages/shared packages/shared
COPY apps/api apps/api

ENV HOST=0.0.0.0
ENV PORT=8080
EXPOSE 8080

WORKDIR /app/apps/api

# src/runner/run.sh is read via `new URL("./run.sh", import.meta.url)` at
# startup (apps/api/src/runner/script.ts), so it must stay next to
# src/runner/script.ts at runtime; the plain `COPY apps/api apps/api` above
# preserves that layout unchanged.
CMD ["npx", "tsx", "src/server.ts"]
