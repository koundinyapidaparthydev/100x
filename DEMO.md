# Code MVP demo

Local path that must work: **ticket in → PII firewall → AI pass → artifact on board → audit trail**.

## 5-click path

1. `npm run demo` (API `:4000`, web `:3000`).
2. Open http://localhost:3000/login and sign in as `manager@acme.demo` / `demo`.
3. Open **Triage** — tickets **MVP-A** (AI-first) and **MVP-B** (PII redact) are in the queue.
4. Send **MVP-A** to AI (or `curl -X POST http://localhost:4000/api/v1/demo/run`).
5. Open the work item — draft artifact is attached and the audit trail shows `pii_scanned` → `ai_started` → `ai_finished` → `artifact_attached`.

Ticket **MVP-B** has an email + phone; the firewall redacts them before any model call. Ticket **MVP-C** is human-first; AI is refused.

## Env vars

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `4000` | API listen port |
| `PERSIST` | `1` (demo script) | Write `backend/data/store.json` |
| `DATA_DIR` | `backend/data` | Persist directory |
| `DEMO_SEED` | `1` (demo script) | Apply Code MVP tickets on boot |
| `DEMO_MANAGER_PASSWORD` | `demo` | Manager password login |
| `AUTH_ALLOW_DEMO_LOGIN` | `1` (demo script) | Password / identity login (no Okta) |
| `AUTH_SESSION_SECRET` | local fallback | Restart-safe sessions |
| `CORS_ORIGINS` | localhost `3000`/`3001`/`8081` | Extra browser origins |
| `OPENAI_API_KEY` | unset | Omit → sandbox runner; set → live OpenAI |
| `ANTHROPIC_API_KEY` / `OPENROUTER_API_KEY` | unset | Optional live models |

Copy `backend/.env.example` → `backend/.env`. Do not commit secrets.

## One-command start

```bash
npm install
npm run demo
# optional: npm run demo:check   (starts API if needed, stops it after)
# or: docker compose up api
```

## CI-equivalent local command

Same quality gate as `.github/workflows/ci.yml` (`quality` job):

```bash
npm ci
npm run typecheck
npm test
npm run build
```

`npm test` runs workspace unit/API tests (backend + shared). It does not start a deploy, Jira OAuth, or Playwright.

Optional local smokes (not required for the CI quality job):

```bash
npm run demo:check
# web Code MVP smokes (needs Chromium): npx playwright install chromium && npm run test:e2e:web -- e2e/demo-mvp.spec.ts
```

`npm run demo:seed` writes the tenant, manager, and three tickets to the persist file so they survive restart.

## Will not build (this demo)

- Live Jira OAuth / webhooks / real board sync
- Okta / Entra / Google Workspace / Apple SSO
- Extra MCP packs (Slack, Datadog, cloud IAM, …)
- Multi-cloud customer adapters / CMK
- Cloud SQL / Postgres as the app database
- Canvas boards, desktop app, native store clients
- Cloud CDN / global HTTPS load balancer
