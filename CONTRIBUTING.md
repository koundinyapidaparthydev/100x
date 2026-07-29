# Contributing to AplifyAI

This repository is **proprietary**. Do not publish it, fork it publicly, or add an open-source license.

## Prerequisites

- **Node.js 22** (see [`.nvmrc`](.nvmrc); `engines` in root [`package.json`](package.json))
- **npm 10+** (workspaces). Do not use Bun or Yarn for this repo.

## Setup

```bash
npm install
```

Copy environment examples as needed:

```bash
cp backend/.env.example backend/.env
# web/mobile .env files are optional for local demo (Vite proxies /api → backend)
```

## Local development

Run processes in separate terminals:

```bash
npm run dev:backend   # API on :4000
npm run dev:web       # control plane on :3000
npm run dev:mobile    # manager triage on :3001
```

`npm run dev` starts the backend only.

## Quality gate (same as CI)

From the repo root:

```bash
npm run typecheck
npm run test
npm run build
```

- `typecheck` runs each workspace `lint` script (`tsc --noEmit`)
- `test` runs backend and shared Vitest suites
- `build` builds web and mobile Vite apps

## Pull requests

1. Keep changes focused; avoid unrelated refactors.
2. Fill out the PR template checklist.
3. Ensure the quality gate passes before requesting review.
4. Never commit `.env`, API keys, or customer data.

## Packages

| Workspace | Role |
|-----------|------|
| `backend` | Express API, PII firewall, orchestration |
| `shared` | Types, API client, theme |
| `web` | Control plane (Vite + React) |
| `mobile` | Manager triage PWA |

Shared contracts live in `shared/` — update docs when they change.
