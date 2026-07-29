# OffshoreHelper

**AI-first work delegation platform** — reduce manual ticket work by letting AI complete a configurable share of each task (10–30%+) before a human engineer picks it up.

OffshoreHelper sits between your issue board (Jira, Canvas, or similar) and your distributed teams (India, US, Australia, or anywhere). Managers control whether AI runs first, which model/platform/cloud to use, token budgets, and how strictly PII and customer data are blocked from AI.

## Why this exists

Today’s flow is mostly human-heavy:

1. Ticket created on a board  
2. Assigned to an offshore / onshore engineer  
3. Engineer uses AI ad hoc to understand context  
4. Engineer finishes the work  

Target flow:

1. Ticket created on a board  
2. **AI runs first** (configurable completion target)  
3. Draft, analysis, patches, or repro notes are attached back to the ticket  
4. Human reviews, completes, and ships  
5. Manager tunes models, clouds, security, and PII rules from web or mobile  

## Product surfaces (v1)

| Surface | Role |
|--------|------|
| **Web app** | Primary control plane: boards, policies, cloud/model config, security, audit |
| **Mobile app** | Manager triage: swipe left/right to send a ticket to AI-first or human-first |

Desktop app is **out of scope for now**.

## Documentation map

Use these docs as the source of truth when splitting work across agents:

| Doc | Purpose |
|-----|---------|
| [docs/VISION.md](docs/VISION.md) | Product vision, goals, non-goals |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How systems connect |
| [docs/FOUNDATION.md](docs/FOUNDATION.md) | What to build first (strong base) |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Phased delivery plan |
| [docs/CUSTOMIZATION.md](docs/CUSTOMIZATION.md) | Who can change which knobs |
| [docs/SCHEMA_SKETCH.md](docs/SCHEMA_SKETCH.md) | Shared API/event contracts |
| [docs/security/SECURITY.md](docs/security/SECURITY.md) | Multi-layer security model |
| [docs/security/PII_RESTRICTIONS.md](docs/security/PII_RESTRICTIONS.md) | PII redaction & AI firewall |
| [docs/ai/AI_DELEGATION.md](docs/ai/AI_DELEGATION.md) | AI-first pipeline & token budgets |
| [docs/ai/MODEL_PLATFORM_CONFIG.md](docs/ai/MODEL_PLATFORM_CONFIG.md) | Models, platforms, private vs public |
| [docs/integrations/JIRA_INTEGRATION.md](docs/integrations/JIRA_INTEGRATION.md) | Jira / board sync |
| [docs/integrations/MCP_INTEGRATIONS.md](docs/integrations/MCP_INTEGRATIONS.md) | MCP tools, attachments, context |
| [docs/integrations/CLOUD_CUSTOMIZATION.md](docs/integrations/CLOUD_CUSTOMIZATION.md) | AWS, Azure, GCP, private cloud |
| [docs/platforms/WEB_PLATFORM.md](docs/platforms/WEB_PLATFORM.md) | Web application |
| [docs/platforms/MOBILE_APP.md](docs/platforms/MOBILE_APP.md) | Mobile manager UX |
| [docs/agents/AGENT_HANDOFF.md](docs/agents/AGENT_HANDOFF.md) | How to split work across agents |

## Core principles

1. **Security first** — enterprise trust; customer data stays safe by default.  
2. **AI before human (optional)** — every ticket can be AI-first, human-first, or policy-driven.  
3. **Everything customizable** — founder, employer, and employee scopes for models, clouds, tokens, code override, and security level.  
4. **PII never reaches the model** unless explicitly allowed by policy.  
5. **Board-native** — Jira (and later Canvas / other boards) remain the system of record.  
6. **Web + mobile only** for the first major releases.

## Intended users

- **Founders / admins** — org-wide cloud, security, and model policies  
- **Employers / managers** — triage, AI-first swipe decisions, team routing  
- **Employees / engineers** — review AI drafts, finish tickets, optional local kit overrides  

## Status

Documentation foundation only. Implementation starts from [docs/FOUNDATION.md](docs/FOUNDATION.md) and [docs/agents/AGENT_HANDOFF.md](docs/agents/AGENT_HANDOFF.md).
