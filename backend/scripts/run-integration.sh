#!/usr/bin/env bash
# Run live Postgres integration tests when a DB URL is available; skip cleanly otherwise.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

URL="${TEST_DATABASE_URL:-${DATABASE_URL:-}}"
if [[ -z "$URL" ]]; then
  echo "[test:integration] Skipping — set TEST_DATABASE_URL (preferred) or DATABASE_URL to run live Postgres tests."
  echo "[test:integration] Unit suite already covers mocked concurrency conflicts (persist.test.ts)."
  exit 0
fi

echo "[test:integration] Running against PostgreSQL (URL host redacted)."
exec npx vitest run src/persist.integration.test.ts
