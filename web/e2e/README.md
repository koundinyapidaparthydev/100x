# Web Playwright E2E

Production-critical flows for the 100x web control plane (`web/`).

## Prerequisites

- Node 22 (see root `.nvmrc`)
- From repo root: `npm install` (or install `@playwright/test` in the web workspace)
- Chromium: `npx playwright install chromium` (from `web/`)

## Servers

`playwright.config.ts` starts both via `webServer` on **dedicated ports** (avoids colliding with apps on :3000/:4000):

1. **Backend** — port `4100` (`E2E_BACKEND_PORT`)
   Env: `AUTH_SESSION_SECRET` (set by config), `AUTH_ALLOW_DEMO_LOGIN=1`, in-memory store (`PERSIST=0`).
2. **Web** — port `3100` (`E2E_WEB_PORT`); Vite proxies `/api` → backend via `API_PROXY_TARGET`.

Set `PW_REUSE_SERVER=1` only when you intentionally reuse already-running E2E servers on those ports.

Manual alternative:

```bash
# terminal 1
PORT=4100 AUTH_SESSION_SECRET='100x-e2e-session-secret-32b-min' AUTH_ALLOW_DEMO_LOGIN=1 PERSIST=0 \
  npm run start -w 100x-backend

# terminal 2
API_PROXY_TARGET=http://127.0.0.1:4100 WEB_PORT=3100 npm run dev -w 100x-web -- --port=3100 --host=127.0.0.1

# terminal 3
PW_REUSE_SERVER=1 npm run test:e2e -w 100x-web
```

## Commands

```bash
# from repo root
npm run test:e2e:web

# from web/
npm run test:e2e
npm run test:e2e -- --grep "Auth gate"
npm run test:e2e -- e2e/auth.spec.ts
```

## Suites

| Spec | Coverage |
|------|----------|
| `auth.spec.ts` | Auth gate, manager login, logout/session |
| `boards.spec.ts` | List / sync / connect sandbox board |
| `policies.spec.ts` | Policy + PII edit persist |
| `triage.spec.ts` | AI-first and human-first from ticket detail |
| `approvals-audit.spec.ts` | Approvals, admin/notifications entry, audit log |
| `rbac.spec.ts` | Engineer 403 UX on boards/policies |

## CI note

Workflow ownership lives with the CI agent. Prefer a dedicated job that runs `npm run test:e2e:web` after `npx playwright install --with-deps chromium` in `web/`. Do not assume this folder wires `.github/workflows` itself.
