# Combined 100x web + API for Cloud Run (same-origin /api).
# Build from repository root.

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/tsconfig.json ./backend/
COPY shared/package.json ./shared/package.json
COPY web/package.json ./web/package.json
RUN mkdir -p mobile \
  && printf '%s\n' '{"name":"100x-mobile","private":true,"version":"0.0.0"}' > mobile/package.json
COPY backend/src ./backend/src
COPY shared ./shared
COPY web ./web
RUN npm ci
RUN npm run build -w 100x-web
WORKDIR /app/backend
RUN npx --yes esbuild@0.25.0 src/index.ts \
  --bundle \
  --platform=node \
  --target=node22 \
  --format=esm \
  --packages=external \
  --outfile=dist/index.js

FROM node:22-bookworm-slim AS runtime
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl nginx gettext-base \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production \
    NPM_CONFIG_UPDATE_NOTIFIER=false

COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY shared/package.json ./shared/package.json
COPY web/package.json ./web/package.json
RUN mkdir -p mobile \
  && printf '%s\n' '{"name":"100x-mobile","private":true,"version":"0.0.0"}' > mobile/package.json
RUN npm ci --omit=dev --workspace 100x-backend --include-workspace-root=false --ignore-scripts \
  && npm cache clean --force

COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/web/dist /var/www/html
COPY deploy/nginx.conf.template /etc/nginx/nginx.conf.template
COPY deploy/start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 8080
CMD ["/start.sh"]
