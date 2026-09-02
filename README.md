# 100x

**AI-first work delegation platform** — reduce manual ticket work by letting AI complete a configurable share of each task (10–30%+) before a human engineer picks it up.

```bash
npm install && npm run demo
# web http://localhost:3000   api http://localhost:4000
# login  manager@acme.demo / demo
# path   ticket → PII firewall → AI pass → artifact on board → audit
```

See [DEMO.md](DEMO.md) for the 5-click path, env vars, and what this demo will not build.

100x sits between your issue board (Jira, Canvas, or similar) and your distributed teams (India, US, Australia, or anywhere). Managers control whether AI runs first, which model/platform/cloud to use, token budgets, and how strictly PII and customer data are blocked from AI.

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
| [docs/MASTER_PLAN.md](docs/MASTER_PLAN.md) | Full-flow master plan (H0 align → H1 real foundation → H2 scale) |
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
| [docs/integrations/FEDERATED_SSO.md](docs/integrations/FEDERATED_SSO.md) | Okta, Entra, Google Workspace, Google, Apple sign-in |
| [docs/integrations/JIRA_INTEGRATION.md](docs/integrations/JIRA_INTEGRATION.md) | Jira / board sync |
| [docs/integrations/MCP_INTEGRATIONS.md](docs/integrations/MCP_INTEGRATIONS.md) | MCP tools, attachments, context |
| [docs/integrations/CLOUD_CUSTOMIZATION.md](docs/integrations/CLOUD_CUSTOMIZATION.md) | AWS, Azure, GCP, private cloud |
| [docs/platforms/WEB_PLATFORM.md](docs/platforms/WEB_PLATFORM.md) | Web application |
| [docs/platforms/MOBILE_APP.md](docs/platforms/MOBILE_APP.md) | Mobile manager UX |
| [docs/agents/AGENT_HANDOFF.md](docs/agents/AGENT_HANDOFF.md) | How to split work across agents |
| [docs/deployment/GCP_STAGING.md](docs/deployment/GCP_STAGING.md) | GCP staging (Cloud Run, Terraform) |
| [docs/deployment/ROLLBACK.md](docs/deployment/ROLLBACK.md) | Staging rollback / recovery |

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

**H0 complete · H1 partial · GCP staging infra scaffolded**

| Area | State |
|------|--------|
| H0 sandbox loop (web + mobile) | Done — triage, PII firewall, audit, PWA shell |
| H1 session login + Bearer token | Done for demo; harden/sign sessions still open |
| H1 RBAC | Manager+ on some policy/board writes; not complete on all mutating routes |
| H1 file persistence | Done (`PERSIST` / `DATA_DIR`) for local demos |
| H1 BoardConnector / ModelRunner | Interfaces + sandbox default; optional Jira API token + OpenAI when env set |
| H1 real Jira OAuth / webhooks / durable Postgres | Not done (staging Cloud SQL is provisioned for the cutover) |
| Hosted staging | Terraform + Dockerfile under `infra/gcp` and `backend/` — **dedicated GCP project only**; see [docs/deployment](docs/deployment/README.md) |

See [docs/MASTER_PLAN.md](docs/MASTER_PLAN.md).

### Run locally

```bash
npm run demo                       # seed + API :4000 + web :3000
# or separately:
cd backend && npm run dev          # :4000
cd web && npm run dev              # :3000 control plane
cd mobile && npm run dev           # :3001 manager triage
```

### Container / GCP staging (optional)

```bash
# API image (from repo root)
docker build -f backend/Dockerfile -t 100x-api:local .

# Infra (dedicated staging project — never commit real project IDs)
cd infra/gcp && cp terraform.tfvars.example terraform.tfvars
# edit terraform.tfvars, then: terraform init && terraform plan
```

Full steps: [docs/deployment/GCP_STAGING.md](docs/deployment/GCP_STAGING.md).