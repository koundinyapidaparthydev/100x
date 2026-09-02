#!/usr/bin/env bash
# Curl health + POST /demo/run. Assumes the API is already listening.
set -euo pipefail

BASE="${DEMO_API_BASE:-http://localhost:4000/api/v1}"
TRIES="${DEMO_CHECK_TRIES:-20}"

echo "[demo-check] GET ${BASE}/health"
health=""
for i in $(seq 1 "$TRIES"); do
  if health="$(curl -sf "${BASE}/health")"; then
    break
  fi
  sleep 0.5
done
if [[ -z "$health" ]]; then
  echo "[demo-check] health failed after ${TRIES} tries" >&2
  exit 1
fi
echo "$health"

echo "[demo-check] POST ${BASE}/demo/run"
run="$(curl -sf -X POST "${BASE}/demo/run" -H 'Content-Type: application/json' -d '{}')"
echo "$run" | head -c 2000
echo

python3 - <<'PY' "$health" "$run"
import json, sys
health = json.loads(sys.argv[1])
run = json.loads(sys.argv[2])
assert health.get("ok") is True, health
assert health.get("pii") is True, health
assert health.get("runner"), health
assert health.get("persist"), health
job = run.get("job") or {}
assert job.get("state") == "ready_for_human", job.get("state")
assert run.get("artifact"), "missing artifact"
actions = {e.get("action") for e in run.get("audit") or []}
needed = {"pii_scanned", "ai_started", "ai_finished", "artifact_attached"}
missing = needed - actions
assert not missing, f"missing audit events: {missing}"
print("[demo-check] ok")
PY
