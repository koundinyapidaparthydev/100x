#!/usr/bin/env bash
# One-command local Code MVP: seed + API :4000 + web :3000
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export PERSIST="${PERSIST:-1}"
export DEMO_SEED="${DEMO_SEED:-1}"
export AUTH_ALLOW_DEMO_LOGIN="${AUTH_ALLOW_DEMO_LOGIN:-1}"
export PORT="${PORT:-4000}"
export WEB_PORT="${WEB_PORT:-3000}"

if [[ ! -d node_modules ]]; then
  npm install
fi

npm run demo:seed -w 100x-backend

echo "[demo] API  http://localhost:${PORT}  (POST /api/v1/demo/run)"
echo "[demo] Web  http://localhost:${WEB_PORT}"
echo "[demo] Login  manager@acme.demo / ${DEMO_MANAGER_PASSWORD:-demo}"
echo "[demo] Sandbox demo — no live Jira"

cleanup() {
  if [[ -n "${API_PID:-}" ]]; then kill "${API_PID}" 2>/dev/null || true; fi
  if [[ -n "${WEB_PID:-}" ]]; then kill "${WEB_PID}" 2>/dev/null || true; fi
}
trap cleanup EXIT INT TERM

npm run dev:backend &
API_PID=$!
npm run dev:web &
WEB_PID=$!

wait
