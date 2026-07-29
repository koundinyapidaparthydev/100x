# OffshoreHelper Mobile

Manager triage surface for the OffshoreHelper AI-first work delegation platform.
Swipe Jira tickets right to send them **AI-first** (AI runs first under policy), left to keep them **human-first**.

## Run locally

**Prerequisites:** Node.js, and the OffshoreHelper backend running on port `4000`.

1. Install dependencies:
   ```sh
   npm install
   ```
2. Start the backend (see `../backend`) so it listens on `http://localhost:4000`. The Vite dev server proxies `/api` there.
3. Start the mobile app:
   ```sh
   npm run dev
   ```
   The app runs on **http://localhost:3001**.

## Scripts

- `npm run dev` — Vite dev server on :3001 (proxies `/api` → :4000)
- `npm run build` — production build to `dist/`
- `npm run lint` — type-check (`tsc --noEmit`)
- `npm run preview` — preview the production build

## Structure

- `src/screens/` — Splash, Login, Triage (swipe deck), TicketDetail, Jobs, Approvals, Notifications, PiiBlocked
- `src/components/` — Layout (header + bottom nav), TrustStrip, shared async states
- `src/lib/` — `useAsync` data hook, `cn` class helper
- `../shared/` — single theme (`theme.css`) and typed API client (`api.ts`) shared with the web app (read-only)
