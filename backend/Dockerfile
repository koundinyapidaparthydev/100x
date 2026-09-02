# 100x API — production-minded image for Cloud Run / containers.
#
# Build from the repository root (shared types live outside backend/):
#   docker build -f backend/Dockerfile -t 100x-api:demo-mvp .
#
# Do not bake secrets into the image. Pass them at runtime via env.

# -----------------------------------------------------------------------------
# deps — install npm packages once
# -----------------------------------------------------------------------------
FROM node:22-bookworm-slim AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY shared/package.json ./shared/package.json
COPY web/package.json ./web/package.json
COPY mobile/package.json ./mobile/package.json
RUN npm ci --workspace 100x-backend --include-workspace-root=false --ignore-scripts

# -----------------------------------------------------------------------------
# build — bundle ESM entry without requiring package.json script changes
# -----------------------------------------------------------------------------
FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY backend/package.json backend/tsconfig.json ./backend/
COPY backend/src ./backend/src
COPY shared ./shared

WORKDIR /app/backend
# Bundle the server; leave runtime deps (express, cors) external.
RUN npx --yes esbuild@0.25.0 src/index.ts \
  --bundle \
  --platform=node \
  --target=node22 \
  --format=esm \
  --packages=external \
  --outfile=dist/index.js

# -----------------------------------------------------------------------------
# runtime — non-root, production deps only
# -----------------------------------------------------------------------------
FROM node:22-bookworm-slim AS runtime

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system --gid 10001 app \
  && useradd --system --uid 10001 --gid app --home /app --shell /usr/sbin/nologin app

WORKDIR /app

ENV NODE_ENV=production \
    PORT=8080 \
    # Cloud Run / K8s expect the process to listen on $PORT
    NPM_CONFIG_UPDATE_NOTIFIER=false

COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY shared/package.json ./shared/package.json
COPY web/package.json ./web/package.json
COPY mobile/package.json ./mobile/package.json
RUN npm ci --omit=dev --workspace 100x-backend --include-workspace-root=false --ignore-scripts \
  && npm cache clean --force

COPY --from=build /app/backend/dist ./backend/dist

RUN mkdir -p /data && chown app:app /data
VOLUME ["/data"]

USER app
EXPOSE 8080

# Matches GET /api/v1/health (router mount /api/v1 + /health).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:8080/api/v1/health" || exit 1

CMD ["node", "backend/dist/index.js"]
