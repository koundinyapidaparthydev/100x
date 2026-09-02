# Test MVP (items 41–65)

Code MVP path: ticket → PII firewall → sandbox AI → artifact → audit. No deploy, no Jira OAuth, no new product features.

## Counts

| Suite | Result |
| --- | --- |
| Backend unit/API (`npm test -w 100x-backend`) | **158 passed** (was 150) |
| Shared (`npm test -w @100x/shared`) | **10 passed** |
| Root `npm test` | **168 passed**, exit 0 |
| `scripts/demo-check.sh` | **exit 0** (starts API if needed, stops after) |
| Playwright `e2e/demo-mvp.spec.ts` | **2 passed** |
| Native mobile / store release | **skipped** (no Detox/store runner in this pass) |

## Items 41–65

| # | Item | Result | Notes |
| --- | --- | --- | --- |
| 41 | Unit: PII detects email and phone on ticket B | **pass** | `sanitize()` on MVP-B; ≥2 redactions; raw email/phone gone |
| 42 | Unit: PII does not false-positive ticket A | **pass** | MVP-A → `{ redactions: 0, blocks: [] }` |
| 43 | Unit: unsanitized payload cannot reach the model runner | **pass** | Captured runner prompt has no MVP-B email/phone |
| 44 | Unit: sandbox runner returns a draft without OpenAI | **pass** | `SandboxModelRunner.run()` draft includes `MVP-A` |
| 45 | Unit: token budget exceeded fails the job cleanly | **pass** | Job `failed` / `token_budget_exceeded`; no `ai_started` |
| 46 | Unit: audit events are emitted in order for a happy path | **pass** | Matches `backend/src/fixtures/golden-audit-sequence.json` |
| 47 | Unit: human-first ticket C never starts an AI job | **pass** | Triage C → 409; no job; no `ai_started` |
| 48 | Integration: seed → login → list tickets | **pass** | `manager@acme.demo` / `demo`; list includes MVP-A/B/C |
| 49 | Integration: POST /demo/run returns artifact + audit | **pass** | `ready_for_human` + artifact + required audit actions |
| 50 | Integration: persist survives process restart | **pass** | Save → `loadOrCreateStore` → new app still lists MVP tickets |
| 51 | Integration: failed runner leaves ticket usable | **pass** | GET ticket still 200; human-first retry succeeds |
| 52 | API test: health shape `{ ok, pii, runner, persist }` | **pass** | `/api/v1/health` |
| 53 | API test: unauthenticated write is 401 | **pass** | POST `/work-items/wi-mvp-a/triage` without auth |
| 54 | API test: demo seed is idempotent | **pass** | `applyDemoSeed` twice → still 3 MVP tickets |
| 55 | Web smoke: board renders three tickets | **pass** | Playwright: triage All shows MVP-A/B/C |
| 56 | Web smoke: AI-first action on ticket A | **pass** | Playwright: `triage-ai-MVP-A` |
| 57 | Web smoke: audit panel visible after job | **pass** | Playwright: `task-audit-trail` on MVP-A |
| 58 | Mobile/PWA smoke: ticket list loads | **pass** | Playwright 390×844 viewport; **store release skipped**; native Detox not run |
| 59 | Script: `npm test` exits 0 | **pass** | 168 tests |
| 60 | Script: `scripts/demo-check.sh` exits 0 | **pass** | Starts API if needed, stops after |
| 61 | Fixture: golden audit sequence JSON | **pass** | `backend/src/fixtures/golden-audit-sequence.json` |
| 62 | Keep existing adversarial PII samples | **pass** | `backend/src/pii.test.ts` unchanged |
| 63 | No test writes secrets to logs | **pass** | `assertNoSecrets`; demo-check prints keys/state only |
| 64 | CI-equivalent local command in DEMO.md | **pass** | `npm ci && npm run typecheck && npm test && npm run build` |
| 65 | This file | **pass** | `TEST_MVP.md` |

## How to re-run

```bash
npm test
npm run demo:check
npx playwright install chromium   # once
npm run test:e2e:demo-mvp
```

CI-equivalent (from `DEMO.md` / `.github/workflows/ci.yml`):

```bash
npm ci
npm run typecheck
npm test
npm run build
```
