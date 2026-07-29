# System Architecture

## High-level diagram

```text
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│  Web Control    │     │  Mobile Manager  │     │  Board Systems       │
│  Plane          │     │  App (swipe)     │     │  Jira / Canvas / …   │
└────────┬────────┘     └────────┬─────────┘     └──────────┬──────────┘
         │                       │                          │
         └───────────┬───────────┘                          │
                     ▼                                      │
         ┌───────────────────────┐                          │
         │  API Gateway + Auth   │◄─────────────────────────┘
         │  (TLS, WAF, rate lim) │
         └───────────┬───────────┘
                     │
         ┌───────────▼───────────┐
         │  Policy & Orchestrator│
         │  - AI-first routing   │
         │  - Token budgets      │
         │  - Model/cloud pick   │
         │  - Security level     │
         └───────────┬───────────┘
                     │
     ┌───────────────┼───────────────┐
     ▼               ▼               ▼
┌─────────┐   ┌─────────────┐  ┌──────────────┐
│ PII     │   │ MCP Context │  │ Audit / Logs │
│ Firewall│   │ Layer       │  │ & Evidence   │
└────┬────┘   └──────┬──────┘  └──────────────┘
     │               │
     └───────┬───────┘
             ▼
   ┌─────────────────────┐
   │  AI Execution Plane │
   │  (customer cloud or │
   │   private / public) │
   └──────────┬──────────┘
              │
              ▼
   ┌─────────────────────┐
   │  Artifact Store     │
   │  (drafts, patches,  │
   │   attachments)      │
   └──────────┬──────────┘
              │
              ▼
   ┌─────────────────────┐
   │  Human Hand-off     │
   │  (assignee + kit)   │
   └─────────────────────┘
```

## Core components

### 1. Control plane (web)

Org settings, project policies, cloud connectors, model catalogs, security levels, user roles, billing/token dashboards.

### 2. Manager mobile client

Fast triage: swipe to mark ticket AI-first / human-first, view AI status, approve high-risk actions.

### 3. Board connector service

Syncs issues, comments, statuses, and attachments from Jira (first) and later Canvas / other boards. Writes AI artifacts back as comments/attachments/custom fields.

### 4. Policy & orchestrator

Decides whether AI runs, which model, which cloud, token ceiling, whether code override is allowed, and which MCP tools may run.

### 5. PII firewall

Scans ticket text, comments, and attachment metadata/content (where allowed). Redacts or blocks before any model prompt is built.

### 6. MCP context layer

Uses MCP tools to gather repo context, docs, linked systems, and attach relevant artifacts without dumping raw secrets into prompts.

### 7. AI execution plane

Runs agents in the customer-selected environment:

- Public managed (if allowed)  
- Private VPC / dedicated  
- Customer AWS / Azure / GCP / private cloud  

### 8. Artifact & audit store

Stores redacted prompts (optional), outputs, patches, completion estimates, token usage, and security events. Prefer customer-owned storage when configured.

## Data flow (AI-first ticket)

1. Board webhook / poll creates or updates `WorkItem` in OffshoreHelper.  
2. Manager swipe or org policy sets `aiFirst = true`.  
3. Orchestrator loads project policy (model, cloud, tokens, security, PII).  
4. Connector fetches ticket payload + linked context.  
5. PII firewall produces a **sanitized work packet**.  
6. MCP layer enriches packet with allowed tools only.  
7. AI runner executes within token budget toward target completion %.  
8. Artifacts attached to board ticket; status updated (e.g. “AI Draft Ready”).  
9. Human assignee notified; continues in their kit (with or without override rights).  

## Connection rules

- Boards remain source of truth for ticket identity and human workflow.  
- OffshoreHelper never sends unsanitized PII to models.  
- Customer cloud credentials stay in a secrets vault; never in agent prompts.  
- Employee kit override is gated by policy and audited.  
- All AI actions are attributable (who/what/when/tokens/cloud).  

## Multi-tenancy

- Hard tenant isolation at DB, storage, queue, and key levels.  
- Optional dedicated deployment per enterprise.  
- Cross-tenant data access is forbidden by design.  

## Tech direction (foundation recommendation)

Document intent only — implementation choices land in FOUNDATION:

- API: versioned REST + webhooks  
- Auth: SSO (SAML/OIDC) + RBAC + MFA  
- Queues for AI jobs  
- Encrypted object storage for artifacts  
- Feature flags for security layers and integrations  

See also: [FOUNDATION.md](FOUNDATION.md), [security/SECURITY.md](security/SECURITY.md).
