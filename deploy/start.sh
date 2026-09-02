#!/bin/bash
set -euo pipefail

CLOUD_PORT="${PORT:-8080}"
export CLOUD_PORT
export PORT=8081
export PERSIST="${PERSIST:-1}"
export DATA_DIR="${DATA_DIR:-/tmp/data}"
mkdir -p "$DATA_DIR"

envsubst '${CLOUD_PORT}' < /etc/nginx/nginx.conf.template > /tmp/nginx.conf

node backend/dist/index.js &
NODE_PID=$!

for _ in $(seq 1 40); do
  if curl -fsS "http://127.0.0.1:8081/api/v1/health" >/dev/null 2>&1; then
    break
  fi
  sleep 0.25
done

nginx -c /tmp/nginx.conf -g 'daemon off;' &
NGINX_PID=$!

term() {
  kill -TERM "$NODE_PID" "$NGINX_PID" 2>/dev/null || true
  wait "$NODE_PID" "$NGINX_PID" 2>/dev/null || true
}
trap term SIGTERM SIGINT

wait -n "$NODE_PID" "$NGINX_PID"
EXIT=$?
term
exit "$EXIT"
