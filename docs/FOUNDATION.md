# Foundation First

This project is large. Agents and teams must build a **strong foundation** before feature sprawl. Prefer correctness, security, and clear contracts over speed of UI polish.

## Foundation objectives

1. Trustworthy multi-tenant identity and RBAC  
2. Encrypted configuration for clouds, models, and secrets  
3. Ticket ingestion contract (Jira first)  
4. PII firewall as a mandatory gate (not a plugin)  
5. AI job orchestration with token budgets and audit logs  
6. Artifact write-back to the board  
7. Minimal web admin + minimal mobile triage  

## Build order (do not skip)

### Phase F0 — Repo & contracts

- Monorepo or clearly separated packages: `api`, `worker`, `web`, `mobile`, `packages/shared`  
- Shared OpenAPI / event schemas for `WorkItem`, `Policy`, `AiJob`, `Artifact`, `AuditEvent`  
- Coding standards, CI, secret scanning  

### Phase F1 — Security spine

- AuthN / AuthZ  
- Tenant isolation  
- Secrets vault integration  
- Encryption at rest / in transit  
- Audit event schema  
- Security layer feature flags  

Deliverable: a tenant can log in, set policies, and nothing AI-related can run without passing auth + policy + PII gate stubs.

### Phase F2 — Board connector (Jira)

- OAuth / API token connect  
- Issue sync (create/update)  
- Comment + attachment metadata sync  
- Write-back of AI comment / attachment  

Deliverable: Jira issue appears as a WorkItem; status and comment round-trip works without AI.

### Phase F3 — PII firewall MVP

- Detect email, phone, card last-4 / PAN patterns, customer names/fields as configured  
- Redact + block modes  
- Unit tests with adversarial samples  

Deliverable: no AI job can start with unsanitized payload.

### Phase F4 — AI orchestration MVP

- Queue worker  
- Model + cloud selector from policy  
- Token budget enforcement  
- Dummy / sandbox model runner for CI  
- Artifact storage + board attach  

Deliverable: AI-first job produces a stored draft and attaches it to Jira under budget.

### Phase F5 — Control surfaces MVP

- Web: org settings, connect Jira, set model/cloud, view jobs  
- Mobile: swipe AI-first / human-first on a ticket list  

Deliverable: manager can triage; AI job runs under policy.

## Hard constraints for all foundation PRs

- No public model call without PII gate  
- No plaintext secrets in logs, DB, or prompts  
- Every AI action emits an audit event  
- Feature flags for incomplete security layers  
- Docs updated when contracts change  

## What “done” means for foundation

A demo tenant can:

1. Connect a Jira project  
2. Set security level + PII rules + token budget + model  
3. Swipe a ticket to AI-first on mobile  
4. See a redacted AI draft appear on the ticket  
5. Show an audit trail proving which layers ran  

Only after that should agents expand to multi-cloud polish, Canvas boards, advanced MCP packs, and desktop.
