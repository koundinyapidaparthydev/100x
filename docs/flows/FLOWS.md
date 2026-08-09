# Flows explorer

Interactive architecture map in the web app at **`/flows`** (nav: **Flows**). Available to every signed-in user who finished onboarding.

## Why this exists

When a UI feels wrong, open Flows → pick **Web / Android / iOS** → zoom into the module → screenshot the graph + detail panel → paste it in chat. An agent can then walk that slice and write a focused MD (or patch the UI).

## How to use

1. Open **Flows** in the left nav.
2. Choose a platform tab:
   - **Web** — full console (triage, connections, governance, models).
   - **Android** — Expo mobile tree + emulator API host (`10.0.2.2`).
   - **iOS** — same Expo tree + simulator API host (`127.0.0.1`).
3. Optional: toggle **layers** (UI / Client / API / Backend / Runtime) to declutter.
4. Optional: **Primary path on** highlights the happy-path edges.
5. **Drag** to pan, **scroll** to zoom, or use Zoom / Fit / Reset.
6. **Click a node** — the right panel shows:
   - How data is **constructed**
   - How data is **transmitted**
   - APIs / routes
   - Source files
   - Screenshot tip

## Shared spine (all platforms)

```text
Client UI
  → typed API client (shared/api.ts or mobile/src/api.ts)
  → HTTP /api/v1
  → backend/src/routes.ts (+ auth)
  → backend/src/store.ts
  → (triage aiFirst) orchestrator → runners/model.ts + MCP
```

There are **no client WebSockets**. Everything is REST/JSON.

## Platform differences

| Concern | Web | Android / iOS |
|--------|-----|----------------|
| App shell | `web/src/App.tsx` + Layout | Expo Router `mobile/app/` |
| Session | `web/src/lib/session.ts` (localStorage) | `mobile/src/session.tsx` (SecureStore) |
| API base | `/api/v1` via Vite proxy | Absolute URL (host differs by OS) |
| Onboarding | Server profile `putOnboarding` | Local how-it-works flag only |
| Connections setup | Full MCP connect UI | Read-only on Account; configure on web |
| Models / Cloud UI | Governance runtime pages | No mobile UI; runtime still runs on backend |

Android and iOS share one React Native codebase. Duplicate graphs exist so you can screenshot the **host** node when debugging connectivity.

## Example walkthrough prompts

After selecting a node and screenshotting:

- “Walk the Triage → `triageWorkItem` → orchestrator path and write `docs/flows/triage-ai-first.md`.”
- “This Connections screenshot is wrong — change env scoping and document it.”
- “Explain Android API host vs iOS for local demo.”

## Source of graph data

| File | Role |
|------|------|
| `web/src/lib/flows/webFlow.ts` | Web nodes + edges |
| `web/src/lib/flows/mobileFlow.ts` | Android + iOS graphs |
| `web/src/lib/flows/types.ts` | Node/edge/layer types |
| `web/src/pages/Flows.tsx` | Page + tabs + layer filters |
| `web/src/components/flows/FlowGraphCanvas.tsx` | Pan / zoom / select canvas |
| `web/src/components/flows/FlowDetailPanel.tsx` | Selected module detail |

To add a new module: append a node (with `x`/`y`) and edges in the platform flow file, then restart the web dev server.
