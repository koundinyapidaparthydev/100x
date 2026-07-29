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
