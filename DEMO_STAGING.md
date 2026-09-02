# Demo staging (Code MVP)

Local Docker Compose is the deploy. Cloud Run on `jobseek-459701` is permission-denied; the active GCP project does not have the Cloud Run API enabled (not enabled here). Fly, Railway, and Vercel have no login. TLS is skipped (HTTP on localhost). Cloud SQL, live Jira, and Okta were not provisioned.

Rollback: existing [docs/deployment/ROLLBACK.md](docs/deployment/ROLLBACK.md) — do not expand.

## URLs (this machine)

| Surface | URL |
| --- | --- |
| Web | http://localhost:3001 |
| API | http://localhost:4000 |
| Health | http://localhost:4000/api/v1/health |
| Health via web proxy | http://localhost:3001/api/v1/health |
| Demo run | `POST http://localhost:4000/api/v1/demo/run` |

Platform: **Docker Compose** (`x100-demo`). Images: `100x-api:demo-mvp`, `100x-web:demo-mvp`.

## Auth (documented, not invented)

Browser login: `manager@acme.demo` / `demo` (`AUTH_ALLOW_DEMO_LOGIN=1`).

`POST /api/v1/demo/run` does **not** require a session. It seeds the Code MVP tickets (if needed) and runs ticket MVP-A through the sandbox pipeline.

```bash
curl -sf http://localhost:4000/api/v1/health
curl -sf -X POST http://localhost:4000/api/v1/demo/run -H 'Content-Type: application/json' -d '{}'
```

## Start

```bash
docker compose up --build -d
```

Override ports or the session HMAC via environment (or a gitignored `.env`). Do not mount secret files into the containers.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PERSIST` | `1` | File store on volume `demo-data` |
| `DATA_DIR` | `/data` | Persist path inside the API container |
| `DEMO_SEED` | `1` | Seed tenant + MVP tickets on first boot |
| `AUTH_ALLOW_DEMO_LOGIN` | `1` | Demo password login |
| `AUTH_SESSION_SECRET` | local-only HMAC (override in env) | Restart-safe sessions |
| `CORS_ORIGINS` | `http://localhost:3001,http://127.0.0.1:3001` | Browser origin for the web port |
| `API_URL` | `http://api:8080` | Web nginx upstream (compose network) |

Sandbox runner and sandbox board are the default: omit `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `OPENROUTER_API_KEY` and all `JIRA_*` / `OKTA_*`.

Against a running API, `POST /api/v1/demo/run` re-applies the seed. `npm run demo:seed` writes the persist file for a local Node process (`PERSIST=1`), not the container.

## Will not build (this deploy)

- Cloud SQL / Postgres
- Live Jira OAuth or board tokens
- Okta / other federated SSO
- A second cloud (Fly + GCP, Vercel + Compose, etc.)
- Full retest suite

## Deploy checklist (66–85)

| # | Item | Result |
| --- | --- | --- |
| 66 | API image boots with persist volume | **pass** — `/data/store.json` on `demo-data`; seed survives `docker compose restart api` |
| 67 | Compose api + web | **pass** — no Redis/Postgres |
| 68 | Web production build | **pass** — `npm run build -w 100x-web` and image build |
| 69 | Staging env | **pass** — persist + sandbox runner + sandbox board; no `JIRA_*` |
| 70 | One platform | **pass** — local Compose (no usable Cloud Run / Fly / Railway) |
| 71 | Web on same stack | **pass** — `100x-web:demo-mvp` in compose (Vercel not logged in) |
| 72 | API_URL / CORS | **pass** — `API_URL=http://api:8080`; `CORS_ORIGINS` includes `:3001` |
| 73 | Seed | **pass** — `DEMO_SEED=1` on boot; `POST /api/v1/demo/run` against the live API |
| 74 | Health URL | **pass** — http://localhost:4000/api/v1/health (`ok`, `pii`, `runner=sandbox`, `persist=file`) |
| 75 | POST /demo/run | **pass** — no session required; `ready_for_human` + artifact |
| 76 | TLS | **skipped** — local HTTP only |
| 77 | Logs hide PII / keys | **pass** — API logs kind/persist only; nginx logs paths |
| 78 | Rollback note | **pass** — existing `ROLLBACK.md` unchanged |
| 79 | This file | **pass** |
| 80 | No Cloud SQL / Jira / Okta | **pass** |
| 81 | Healthcheck matches /health | **pass** — `curl …/api/v1/health` |
| 82 | Smallest instance | **pass** — api 512m / 0.50 cpu; web 64m / 0.25 cpu |
| 83 | Secrets via env | **pass** — `AUTH_SESSION_SECRET` from env, not a mounted file |
| 84 | Images build locally | **pass** |
| 85 | Tag `demo-mvp` | **pass** — `100x-api:demo-mvp`, `100x-web:demo-mvp` |
