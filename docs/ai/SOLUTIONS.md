# Solutions

## Purpose

A **Solution** is the governed training unit for custom models and skills.

It is **not** a draft, an AI job, or an open merge request. A Solution exists only after the full call set for a piece of work has been **approved** (employer / manager / designated reviewer — or the AI reviewer role when policy allows) **and merged**. That frozen call set becomes the corpus entry the platform may use for learning.

```text
Cleared input + AI/human turns + reviewed artifacts
        │
        ▼
   Call set (open)
        │
   Employer / reviewer approves
        │
   Change merges (MR/PR lands)
        │
        ▼
   Solution (immutable training record)
        │
        ├──► Custom model training pairs
        └──► Skill pack categories
```

Related: [MODELS_AND_SKILLS.md](MODELS_AND_SKILLS.md), [AI_DELEGATION.md](AI_DELEGATION.md), [MODEL_PLATFORM_CONFIG.md](MODEL_PLATFORM_CONFIG.md).

## Definitions

| Term | Meaning |
|------|---------|
| **Call set** | The ordered, PII-cleared conversation and artifacts for one work item run (input context, model/tool turns, reviewed draft). Mutable while work is in flight. |
| **Approval** | Explicit accept by a person (or policy-designated reviewer) that the draft/solution is correct enough to ship. |
| **Merge** | The associated change is merged into the target branch (MR/PR merged, or equivalent board “done + shipped” signal when no code change). |
| **Solution** | Immutable snapshot created **only** when a call set is both approved and merged. Eligible for model training and skill extraction. |

## Promotion gate (hard rule)

Promote a call set → Solution **if and only if**:

1. Payload was PII-cleared before any model/tool content was retained for learning.
2. An allowed actor recorded `approved` on the call set (or linked approval).
3. A merge reference is recorded (`mergeRef`: MR/PR URL, commit SHA, or explicit no-code ship marker).
4. Tenant policy allows learning from this project / category.
5. An audit event is emitted for the promotion.

Reject or leave unpromoted when:

- Approval is pending or rejected  
- Merge never happened  
- PII block / incomplete sanitization  
- Org lock disables custom-model / skill learning  

Shadow exports and unsanitized chat dumps **never** become Solutions.

## What a Solution stores

Store only cleared, review-safe material:

- Tenant + work item + source call set id  
- Sanitized input summary (ticket / thread context)  
- Sanitized solution summary (accepted answer / patch narrative)  
- Ordered call turns (roles + cleared content)  
- Artifact ids (patch, tests, notes) already attached under policy  
- Approver id + approvedAt  
- mergeRef + mergedAt  
- Category hint (for skill grouping)  
- Downstream links: which custom models / skill packs consumed this Solution  

Never store raw secrets, unredacted PII, or live credentials.

## Lifecycle

```text
open → approved → merged → promoted (Solution)
                 ↘ rejected (terminal for this call set)
```

After `promoted`, the Solution record is append-only. Corrections create a **new** call set / Solution; the old one may be `archived` or `superseded`, never silently rewritten.

## Who approves

Precedence (same spirit as model locks):

1. Founder / org lock  
2. Employer / project policy reviewer role  
3. Manager on the ticket  
4. Optional AI reviewer **only** when policy explicitly enables it — still cannot bypass merge or PII gates  

Marketing and product copy may say “employer or whoever the AI is”; the contract is: **policy-named approver + merge**, not autopilot promotion.

## Downstream use

Once promoted, a Solution may feed:

| Consumer | Use |
|----------|-----|
| Custom model | `(cleared input, cleared solution)` training pairs |
| Skill packs | Repeated categories → installable skills for Cursor, Claude Code, Codex, ChatGPT, etc. |

Neither consumer may train or publish until the Solution exists. See [MODELS_AND_SKILLS.md](MODELS_AND_SKILLS.md).

## API sketch

```text
GET  /solutions
GET  /solutions/:id
GET  /call-sets
POST /call-sets/:id/approve
POST /call-sets/:id/merge          # records mergeRef
POST /call-sets/:id/promote        # requires approved + merged
POST /solutions/:id/archive
```

Promotion is idempotent: promoting an already-promoted call set returns the existing Solution.

## Metrics

- Call sets approved but not merged (stuck pipeline)  
- Solutions promoted / week  
- % Solutions used in at least one model or skill  
- Rejection rate after approval (process smell)  
- PII blocks that prevented promotion  

## Non-goals (near term)

- Auto-promoting every green CI merge without human approval  
- Training on uncleared production tickets  
- Letting employees export Solutions outside tenant policy  
- Replacing board / git as system of record for merge truth  

## Build notes

Contracts live in `shared/types.ts`. Runtime layer: `backend/src/solutions.ts` (+ learning layer in `backend/src/learning.ts`). Persist under tenant-scoped store collections; hydrate defaults for older snapshots.
