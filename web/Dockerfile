# 100x web — production static + /api proxy to the compose API service.
# Build from the repository root:
#   docker build -f web/Dockerfile -t 100x-web:demo-mvp .
#
# Do not bake secrets into the image. API_URL is the in-network upstream only.

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY shared/package.json ./shared/package.json
COPY web/package.json ./web/package.json
COPY mobile/package.json ./mobile/package.json
RUN npm ci
COPY shared ./shared
COPY web ./web
RUN npm run build -w 100x-web

FROM nginx:1.27-alpine
COPY deploy/web-nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/web/dist /usr/share/nginx/html
ENV API_URL=http://api:8080
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
