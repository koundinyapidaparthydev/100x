#!/usr/bin/env bash
# Health + POST /demo/run. Starts the API if it is not already listening, then stops it if we started it.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BASE="${DEMO_API_BASE:-http://localhost:4000/api/v1}"
TRIES="${DEMO_CHECK_TRIES:-40}"
STARTED_PID=""

cleanup() {
  if [[ -n "${STARTED_PID}" ]]; then
    echo "[demo-check] stopping API pid ${STARTED_PID}"
    kill "${STARTED_PID}" 2>/dev/null || true
    wait "${STARTED_PID}" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

health_ok() {
  curl -sf "${BASE}/health" >/dev/null
}

if ! health_ok; then
  echo "[demo-check] API not up; starting backend"
  export PORT="${PORT:-4000}"
  export DEMO_SEED="${DEMO_SEED:-1}"
  export AUTH_ALLOW_DEMO_LOGIN="${AUTH_ALLOW_DEMO_LOGIN:-1}"
  export PERSIST="${PERSIST:-0}"
  npm run start -w 100x-backend >/tmp/100x-demo-check-api.log 2>&1 &
  STARTED_PID=$!
  for _ in $(seq 1 "$TRIES"); do
    if health_ok; then
      break
    fi
    if ! kill -0 "${STARTED_PID}" 2>/dev/null; then
      echo "[demo-check] API process exited; see /tmp/100x-demo-check-api.log" >&2
      exit 1
    fi
    sleep 0.5
  done
  if ! health_ok; then
    echo "[demo-check] health failed after ${TRIES} tries" >&2
    exit 1
  fi
fi

echo "[demo-check] GET ${BASE}/health"
health="$(curl -sf "${BASE}/health")"
# Print shape keys only — never dump env or secrets.
python3 - <<'PY' "$health"
import json, sys
health = json.loads(sys.argv[1])
print("[demo-check] health", {k: health.get(k) for k in ("ok", "pii", "runner", "persist")})
assert health.get("ok") is True, health
assert health.get("pii") is True, health
assert health.get("runner"), health
assert health.get("persist"), health
PY

echo "[demo-check] POST ${BASE}/demo/run"
run="$(curl -sf -X POST "${BASE}/demo/run" -H 'Content-Type: application/json' -d '{}')"

python3 - <<'PY' "$run"
import json, sys
run = json.loads(sys.argv[1])
job = run.get("job") or {}
assert job.get("state") == "ready_for_human", job.get("state")
assert run.get("artifact"), "missing artifact"
actions = [e.get("action") for e in run.get("audit") or []]
needed = ["pii_scanned", "ai_started", "ai_finished", "artifact_attached"]
cursor = 0
for action in actions:
    if cursor < len(needed) and action == needed[cursor]:
        cursor += 1
assert cursor == len(needed), f"missing or out-of-order audit events: {needed[cursor:]}"
# Do not print job/artifact bodies (may contain ticket text).
print("[demo-check] demo/run", {"state": job.get("state"), "audit": needed})
print("[demo-check] ok")
PY
