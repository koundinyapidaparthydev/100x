# AplifyAI — Master Plan

Source of truth for making the **full product flow** correct and aligned. Complements [FOUNDATION.md](FOUNDATION.md), [ROADMAP.md](ROADMAP.md), and [VISION.md](VISION.md).

## Product flow (exact)

```text
Ticket lands on board (Jira)
        │
        ▼
 Manager triages (mobile swipe / web)
   ├─ AI-first ──► PII firewall ──► (block | redact) ──► token budget
   │                    │                                    │
   │                    └─ blocked_pii ──► notify manager    │
   │                                                         ▼
   │                                              Sandbox/real model
   │                                                         │
   │                                              Artifacts + board attach
   │                                                         │
   │                                              ready_for_human + audit
   │                                                         │
   └─ Human-first ──► skip AI ──► engineer queue

 Control plane (web): policies, models, cloud, PII, boards, audit, admin
```

**Foundation demo done** when a tenant can: connect a board → set security/PII/budget/model → swipe AI-first → see redacted draft on the ticket → prove layers via audit.

## Delivery strategy

Keep **sandbox Jira + sandbox model** until the full loop is correct, then swap adapters for real connectors without changing contracts.

| Horizon | Goal |
|---------|------|
| **H0 — Align & complete** | End-to-end sandboxed loop works on web + mobile; every screen wired; mobile web polished (**done**) |
| **H1 — Real foundation** | Auth/RBAC, persistence, BoardConnector/ModelRunner, optional live Jira token + OpenAI; **GCP staging infra** (Cloud Run/SQL); Postgres app adapter + full Jira OAuth still open |
| **H2 — Scale** | Multi-cloud customer adapters, MCP gateway, enterprise security hardening, CDN/LB, native mobile shells |

## H0 workstreams (current target)

### WS-1 — Contracts & API writes

- `PATCH /policies/:id` — security, PII, model, cloud, token budget
- `POST /boards/connect`, `POST /boards/:projectId/sync` — sandbox board registry
- Always set `workItem.lastAiJobId` on any job outcome
- Durable human-first (`lastTriageDecision`) so tickets leave the triage queue
- Mark notification read; expose artifact body for draft review
- Demo actor header for audit attribution

### WS-2 — Web control plane

- Wire Audit Log to real `listAuditEvents` + layer chips
- Editable Policies / PII Rules / Models / Cloud (persist via PATCH)
- Boards: Connect + Sync + issue list → TaskDetail
- TaskDetail: full draft, stay on ticket after AI, show job on PII block
- Admin: tenant summary (demo), not dead cards

### WS-3 — Mobile web (must be excellent)

- Project filter on triage; token budget strip; button fallbacks + long-press overrides
- Durable human-first; no re-triage when already decided
- Ticket detail: drafts, layers, assignee hand-off field; redact-sensitive body display
- Notifications: tap-through + mark read; nav badges
- PII screen: load blocked jobs; wire Ask for Access (creates approval)
- PWA: icons, usable service worker, safe areas
- Login: honest demo session gate (not fake SSO claims)

### WS-4 — Docs & README

- README status reflects working foundation demo
- Keep SCHEMA / types / API in sync

## H1 — Real foundation (current)

Build adapters and spine so sandbox can be swapped for production without rewriting the product flow.

**Actual H1 state (honest):** adapters and demo auth exist; real Jira ingestion/OAuth, full RBAC coverage, and Postgres-backed durability are **not** finished. Treat checked items below as “slice landed,” not “production-ready.”

### WS-H1-A — Auth / RBAC
- Demo login issues short-lived session tokens (Bearer)
- Roles: `founder` | `manager` | `engineer` | `auditor`
- Middleware attaches session; mutating policy/board routes require founder|manager
- Clients store token; audit uses session identity
- **Gap:** sessions are not yet cryptographically durable across restarts; not every mutating route has explicit role checks

### WS-H1-B — Persistence
- File-backed store (`DATA_DIR` / default `backend/data/store.json`) so demos survive restarts
- Tests stay in-memory (no disk)
- **Gap:** Cloud Run needs Postgres (Cloud SQL provisioned in staging Terraform); file store is local/demo only

### WS-H1-C — BoardConnector
- Interface: `connectProject`, `syncProject`, `addComment`, `addAttachment`
- Sandbox adapter (default); Jira Cloud adapter behind `JIRA_BASE_URL` + token when set
- **Gap:** connect/sync paths and OAuth/webhooks still need hardening for a real board round-trip

### WS-H1-D — ModelRunner
- Interface: `run({ sanitized, workItem, policy, targetPercent })`
- Sandbox runner (default / CI); live multi-provider when `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `OPENROUTER_API_KEY` are set (`auto` picks first configured)

### WS-H1-E — GCP staging (infra)
- Dedicated GCP project design (do not reuse personal cloud accounts)
- Terraform under `infra/gcp`: Cloud Run, Artifact Registry, Secret Manager, Cloud SQL Postgres, GCS artifacts/static, IAM, logging/monitoring basics
- Backend `Dockerfile` + deployment/rollback docs under `docs/deployment/`
- **Follow-up:** Cloud CDN + HTTPS LB for static clients; app Postgres adapter consuming `DATABASE_URL`

### Definition of done — H1 (slice)
- [x] Login returns a session token used by web + mobile
- [x] Policy/board mutations require manager+ role (partial — expand remaining mutators)
- [x] Store persists across backend restarts when DATA_DIR/PERSIST enabled (local file store)
- [x] Orchestrator calls ModelRunner + BoardConnector (not inline sandbox only)
- [x] Optional OpenAI path works when key present; CI stays sandbox
- [x] Sessions restart-safe / signed; mutation RBAC matrix tested
- [ ] Real Jira ingest + artifact write-back verified (API token path); OAuth later
- [x] GCP staging Terraform + container image path documented (apply in dedicated project only)
- [ ] Staging redeploy preserves data via Cloud SQL (requires app Postgres adapter)

## H2+ (later)

1. Normalize the current single-writer PostgreSQL JSONB snapshot for horizontal scaling
2. Real Jira OAuth + webhooks
3. MCP enriching step
4. Multi-cloud customer adapters + CMK (GCP is the first hosted target)
5. Complete native iOS/Android store release pipeline
6. Cloud CDN / global HTTPS LB for web + mobile static hosting

## Hard rules (never violate)

1. No model call without PII gate
2. Every AI state transition emits audit with `securityLayersApplied`
3. No plaintext secrets in logs or prompts
4. Shared types in `shared/` are the contract — update docs when they change
5. Mobile is a **decision surface**, not a full admin console

## Definition of done — H0

- [x] Manager can connect a sandbox board from web
- [x] Manager can change PII/model/budget/security and see it affect the next job
- [x] Mobile swipe AI-first produces draft visible on ticket (web + mobile)
- [x] PII-block path shows categories, job, and notification deep-link
- [x] Human-first removes ticket from triage permanently (until reset)
- [x] Audit Log shows real events and layers
- [x] Mobile web: polished triage, badges, empty/error states, PWA installable shell
- [x] Tests cover policy update, triage outcomes, PII block, human-first durability

## Non-goals for H0

- Real Jira / real LLM / real SSO
- Desktop app
- Full offline mobile
- Multi-cloud production adapters
