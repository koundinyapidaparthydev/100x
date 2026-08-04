# Custom Models & Skills

## Purpose

Same governed history, **two products**:

1. **Custom model** — train on Solution pairs (cleared input + cleared solution), then serve governed requests when a new task matches closely enough.  
2. **Skills** — group repeated Solution categories into skill packs developers install in Cursor, Claude Code, Codex, ChatGPT, and similar kits.

Nothing in this layer runs on drafts or unmerged work. Training and skill publish require **Solutions** only. See [SOLUTIONS.md](SOLUTIONS.md).

```text
Solutions (approved + merged call sets)
        │
        ├──────────────────────────────┐
        ▼                              ▼
 Custom model pipeline          Skill pack pipeline
 (pairs → train → serve)        (categorize → pack → ship to kits)
```

## Setup layer (what we are building now)

Establish contracts and a sandbox-capable control plane **before** real fine-tuning vendors or kit marketplaces.

| Layer | Responsibility |
|-------|----------------|
| **Solution corpus** | Promote + list Solutions; enforce PII / approval / merge gates |
| **Learning registry** | Tenant-scoped CustomModel + SkillPack records |
| **Pair builder** | Map Solutions → training pairs (no raw PII) |
| **Category indexer** | Group Solutions by category for skill candidates |
| **Publish gates** | Human review before a model is `ready` or a skill is `published` |
| **Serve / install stubs** | Policy-checked “try model” and “export skill pack” APIs (sandbox first) |

Hard rules:

- No training payload leaves the tenant cloud policy path  
- No skill ships to an agent kit without publish approval  
- Model serve still goes through PII firewall + token budget ([AI_DELEGATION.md](AI_DELEGATION.md), [MODEL_PLATFORM_CONFIG.md](MODEL_PLATFORM_CONFIG.md))  
- Audit every train / publish / serve / install decision  

## Custom models

### Idea

A custom model is trained on **reviewed input + reviewed solution** pairs taken from Solutions. When a new task matches a trained pattern at about **≥ 90%** (configurable per model, default `0.9`), the platform may answer from previously reviewed Solutions under policy.

### States

```text
collecting → queued → training → ready
                              ↘ failed
ready → archived
```

| State | Meaning |
|-------|---------|
| `collecting` | Linked Solutions accumulating; not training yet |
| `queued` | Train job accepted |
| `training` | Sandbox or vendor job in progress |
| `ready` | Artifact available for governed serve |
| `failed` | Train error recorded (no silent fallback to uncleared data) |
| `archived` | Not used for new serves |

### Match & serve

1. Incoming work item is sanitized.  
2. Similarity / retrieval against the custom model’s Solution set.  
3. If score ≥ `matchThreshold`, draft may prefer the custom model path.  
4. Output still attaches to the ticket and remains subject to human review for ship — custom model does **not** auto-merge.

### Model MR gate

Shipping a new custom model (or material weight/config change) should land as a reviewable change after draft review — same human gate spirit as ticket work. Sandbox MVP records `ready` only after an explicit approve on the model record.

## Skills

### Idea

When the same kind of change shows up repeatedly after review, that **category** becomes a **skill pack** the org controls. After publish, developers install it in the kits they already use — platform keeps ownership of the category; the client gets a governed skill, not a shadow prompt.

### States

```text
draft → review → published → archived
```

### Skill pack contents (cleared only)

- Name + category  
- Linked Solution ids (evidence)  
- Instructions / playbook body (sanitized)  
- Target kits: `cursor` | `claude_code` | `codex` | `chatgpt` | `custom`  
- Publish metadata + approver  

### Integration

| Kit | Near-term stub | Later |
|-----|----------------|-------|
| Cursor | Export markdown / rules bundle | Managed install hook |
| Claude Code | Export skill markdown | Managed install hook |
| Codex / ChatGPT | Export pack manifest | Provider-specific packaging |

Publish requires human review. Install outside the platform path is out of policy for enterprise tenants.

## API sketch

```text
# Models
GET  /custom-models
POST /custom-models
POST /custom-models/:id/link-solutions
POST /custom-models/:id/train
POST /custom-models/:id/approve-ready
POST /custom-models/:id/archive

# Skills
GET  /skill-packs
POST /skill-packs
POST /skill-packs/:id/link-solutions
POST /skill-packs/:id/submit-review
POST /skill-packs/:id/publish
POST /skill-packs/:id/archive
GET  /skill-packs/:id/export
```

Capabilities (RBAC):

- `solutions.manage` — promote / archive Solutions  
- `learning.manage` — create/train models and publish skills  

Workspace owners inherit all platform capabilities (existing pattern).

## Parallel build plan

| Stream | Owns | First slice |
|--------|------|-------------|
| **Docs & contracts** | This file + [SOLUTIONS.md](SOLUTIONS.md) + shared types | Done first; keep in sync |
| **Solutions layer** | `backend/src/solutions.ts` | Promote call set → Solution; list/get |
| **Learning layer** | `backend/src/learning.ts` | CustomModel + SkillPack CRUD + sandbox train/publish |
| **API + client** | `routes.ts`, `shared/api.ts` | Auth’d list/create/promote stubs |
| **Web (later)** | Models page expands beyond runtime policy | Corpus + train UI; skills console |
| **Real trainers (later)** | Vendor fine-tune / private GenAI | Swap sandbox runner without changing contracts |

Phases 2–4 style overlap from [ROADMAP.md](../ROADMAP.md): contracts stable → solutions + learning stubs in parallel → UI → real trainers.

## Relationship to Model runtime page

Today’s **Model runtime** page (`web/src/pages/Models.tsx`) configures **which provider/model runs jobs** via Policy. Custom models and skills are a **separate learning product** on top of Solutions — do not conflate runtime selection with training corpus management.

## Non-goals (near term)

- Full fine-tune orchestration against every cloud vendor  
- Auto-publish skills into employee kits without review  
- Using uncleared tickets as training data “because merge succeeded”  
- Replacing PII firewall for custom-model serves  

## Source of product narrative

Landing timelines in `ModelsSkillsTimeline` / `DualTrackFlow` describe the same story for customers; this doc is the engineering contract those UIs must stay aligned with.
