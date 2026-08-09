# AplifyAI Web

Primary control plane for AplifyAI — boards, policies, models, cloud, PII rules, audit, and admin.

## Prerequisites

- Node.js 18+ and npm
- The AplifyAI **backend running on http://localhost:4000** — the Vite dev server proxies all `/api` requests there.

## Run locally

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the backend (from `../backend`) so it listens on port **4000**.

3. Start the web app:

   ```bash
   npm run dev
   ```

   The app runs on **http://localhost:3000**.

## Demo queue

Fresh backends seed **18 triage-pending** tickets (manager decision loop) plus several pending approvals.

**Get 18 pending.** Start with in-memory seed and restart anytime to reseed:

```bash
AUTH_ALLOW_DEMO_LOGIN=1 \
AUTH_SESSION_SECRET='local-dev-session-secret-at-least-32-chars' \
PERSIST=0 \
npm run dev:backend
```

**Reset.** `PERSIST=0`: kill the backend and restart. `PERSIST=1`: delete `backend/data/store.json` (or your `DATA_DIR`), then restart — otherwise an old thin seed sticks.

**API top-up.** If the queue is thin at runtime, from the repo root:

```bash
npm run seed:demo-queue
```

**Connections tokens.** Obtain secrets here on web (Connections page). Condensed Tier 1 checklist:

| Goal | Obtain | Env / UI |
| --- | --- | --- |
| Live Jira board sync | Atlassian API token + site URL + email | `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN` |
| Jira/Confluence MCP tools | Atlassian OAuth app → Authorize in UI | `MCP_ATLASSIAN_CLIENT_ID/SECRET`, `MCP_ATLASSIAN_REDIRECT_URI` |
| GitHub tools | Classic/fine-grained PAT (repo scope) | Connections paste or `MCP_GITHUB_TOKEN` |
| Slack tools | Slack OAuth client **and** MCP bridge URL | `MCP_SLACK_CLIENT_ID/SECRET`, `MCP_SLACK_REDIRECT_URI`, **`MCP_SLACK_URL`** |

See [`backend/.env.example`](../backend/.env.example) and [`docs/integrations/MCP_INTEGRATIONS.md`](../docs/integrations/MCP_INTEGRATIONS.md). Sandbox (no vendor tokens) is enough for triage and approvals; add Tier 1 when you want Connections to show **Connected (live)**.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Vite dev server on :3000 (proxies `/api` → :4000) |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview the production build |
| `npm run lint` | Type-check (`tsc --noEmit`) |

## Project notes

- Theme tokens live in `../shared/theme.css` (single source of truth for web + mobile) and are imported by `src/index.css`. Use semantic tokens (`surface`, `on-surface`, `primary`, `tertiary`, …) — no hardcoded hex colors.
- The typed API client lives in `../shared/api.ts` and is imported via the `@shared` alias (`import { api } from '@shared/api'`).
