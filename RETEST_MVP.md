# Retest MVP (items 86–100)

Retest of the Code MVP on the local Docker Compose stack `x100-demo`. No cloud deploy, no Jira/Okta, no new features. Bugs would have been fixed here; **none were found**.

**100x demo MVP: done.**

## Surface (this machine)

| Surface | URL |
| --- | --- |
| Web | http://localhost:3001 |
| API | http://localhost:4000 |
| Health | http://localhost:4000/api/v1/health |
| Health via web proxy | http://localhost:3001/api/v1/health |
| Demo run | `POST http://localhost:4000/api/v1/demo/run` (no session) |

Login: `manager@acme.demo` / `demo`. Images: `100x-api:demo-mvp`, `100x-web:demo-mvp`. Persist volume: `demo-data` → `/data/store.json`.

## 90-second demo

1. `docker compose up -d` (skip if `x100-demo` is already up).
2. Confirm API: `curl -sf http://localhost:4000/api/v1/health` → `ok`, `pii`, `runner=sandbox`, `persist=file`.
3. Open http://localhost:3001/login and sign in as `manager@acme.demo` / `demo`.
4. Open **Triage → All** — cards **MVP-A** (AI-first), **MVP-B** (PII redact), **MVP-C** (human-first).
5. Send **MVP-A** to AI (or `curl -sf -X POST http://localhost:4000/api/v1/demo/run -H 'Content-Type: application/json' -d '{}'`).
6. Open the work item — draft artifact is attached; audit shows `pii_scanned` → `ai_started` → `ai_finished` → `artifact_attached`.

Ticket **MVP-B** redacts email/phone before the model; raw PII is not in the artifact or API logs. Ticket **MVP-C** refuses AI (`409`, no job).

## Items 86–100

| # | Item | Result | Notes |
| --- | --- | --- | --- |
| 86 | Health from a clean curl | **pass** | `GET http://localhost:4000/api/v1/health` → `{ ok: true, pii: true, runner: "sandbox", persist: "file" }` |
| 87 | Log in as demo manager on staging web | **pass** | http://localhost:3001/login; Playwright `demo-mvp.spec.ts` against compose (`PLAYWRIGHT_BASE_URL=http://localhost:3001 PW_REUSE_SERVER=1`) |
| 88 | Three seeded tickets (MVP-A/B/C) | **pass** | Triage All + `GET /api/v1/work-items` after manager login |
| 89 | Ticket A AI-first; artifact appears | **pass** | UI: `triage-ai-MVP-A` then task page; API: `POST /demo/run` → `ready_for_human` + artifact `att-*` |
| 90 | Ticket B redacted; no raw PII in artifact or logs | **pass** | Triage B → `piiReport.redactions >= 2`; artifacts and `docker logs x100-demo-api-1` have no `jordan.lee@example.com` / `+1 (415) 555-0142` (source ticket description still stores the raw reporter contact) |
| 91 | Ticket C: no AI job | **pass** | `POST …/wi-mvp-c/triage { aiFirst: true }` → `409` `human-first ticket; AI must not run`; `aiStatus=none`; zero `ai-jobs` for C; no `ai_started` for C |
| 92 | Audit trail visible (API or web) | **pass** | Web: `task-audit-trail` on MVP-A; API: `GET /api/v1/audit-events` includes `pii_scanned`, `pii_redacted`, `ai_started`, `ai_finished`, `artifact_attached` |
| 93 | POST /demo/run matches local expectations | **pass** | No session; `job.state=ready_for_human`; artifact + audit sequence including `pii_scanned` → `ai_started` → `ai_finished` → `artifact_attached` |
| 94 | Restart stack; persist still has seed | **pass** | `docker compose restart`; `/data/store.json` on `demo-data`; `GET /demo/status` still `seeded`; list still MVP-A/B/C |
| 95 | Failed-runner path does not 500 the API | **skipped** | No compose/env hook to inject a throwing runner without a new feature. Covered in unit/API tests (`demo.test.ts` model-runner failure → job `failed`, GET ticket 200). Not triggered on this live stack. |
| 96 | CORS / web origin | **pass** | Web nginx proxies `/api/` to `http://api:8080`. Direct API also allows `Origin: http://localhost:3001` (`Access-Control-Allow-Origin`) |
| 97 | Mobile/PWA against this API | **skipped** (native) / **pass** (PWA viewport) | Native Expo app is not a compose service. Same web container at 390×844 loads MVP-A (`demo-mvp.spec.ts` second test) |
| 98 | 90-second demo notes in this file | **pass** | See above |
| 99 | Fix only retest bugs | **pass** | No retest bugs; no product code changes |
| 100 | Mark 100x demo MVP done | **pass** | This file |

## Fixes

None. Retest did not find a product bug.

## Stack after retest

`x100-demo` left **up** and healthy:

- `x100-demo-api-1` — `100x-api:demo-mvp` — `:4000`
- `x100-demo-web-1` — `100x-web:demo-mvp` — `:3001`
