#!/usr/bin/env bash
# Build the backend Dockerfile and curl /api/v1/health. Skips cleanly if Docker is unavailable.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
IMAGE="${APLIFYAI_SMOKE_IMAGE:-aplifyai-api:smoke-local}"
NAME="${APLIFYAI_SMOKE_NAME:-aplifyai-api-smoke}"
PORT="${APLIFYAI_SMOKE_PORT:-18080}"
SECRET="${AUTH_SESSION_SECRET:-aplifyai-smoke-session-secret-32-bytes-min}"

cleanup() {
  docker rm -f "$NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

if ! command -v docker >/dev/null 2>&1; then
  echo "[test:smoke-container] Skipping — docker CLI not found."
  exit 0
fi

if ! docker info >/dev/null 2>&1; then
  echo "[test:smoke-container] Skipping — Docker daemon unavailable."
  exit 0
fi

echo "[test:smoke-container] Building $IMAGE from repo root..."
docker build -f "$REPO_ROOT/backend/Dockerfile" -t "$IMAGE" "$REPO_ROOT"

cleanup
echo "[test:smoke-container] Starting container on localhost:$PORT..."
docker run -d \
  --name "$NAME" \
  -p "$PORT:8080" \
  -e NODE_ENV=production \
  -e PORT=8080 \
  -e AUTH_SESSION_SECRET="$SECRET" \
  -e AUTH_ALLOW_DEMO_LOGIN=0 \
  "$IMAGE" >/dev/null

echo "[test:smoke-container] Waiting for health..."
ok=0
for _ in $(seq 1 40); do
  if curl -fsS "http://127.0.0.1:${PORT}/api/v1/health" >/tmp/aplifyai-smoke-health.json 2>/dev/null; then
    ok=1
    break
  fi
  sleep 1
done

if [[ "$ok" -ne 1 ]]; then
  echo "[test:smoke-container] Health check failed."
  docker logs "$NAME" || true
  exit 1
fi

status="$(node -e "const j=require('/tmp/aplifyai-smoke-health.json'); if(j.status!=='ok') process.exit(1); console.log(j.status)")"
echo "[test:smoke-container] Health OK (status=$status)."
