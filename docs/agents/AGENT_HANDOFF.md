# Agent Handoff Guide

Use this file to **delegate parallel work** to multiple coding agents. Each workstream owns specific docs as requirements and must not invent conflicting APIs.

## Before any agent starts coding

1. Read [../FOUNDATION.md](../FOUNDATION.md)  
2. Read [../ARCHITECTURE.md](../ARCHITECTURE.md)  
3. Read [../security/SECURITY.md](../security/SECURITY.md)  
4. Agree on shared schemas in `packages/shared` (or equivalent): `WorkItem`, `Policy`, `AiJob`, `Artifact`, `AuditEvent`  

## Workstreams

### WS-A — Security & PII

**Owns:** auth, tenant isolation, vault, PII firewall  
**Source docs:**  
- [../security/SECURITY.md](../security/SECURITY.md)  
- [../security/PII_RESTRICTIONS.md](../security/PII_RESTRICTIONS.md)  

**Deliverables:** firewall library + tests; audit event emitter; RBAC middleware  

**Must not:** call external models directly  

---

### WS-B — Board / Jira connector

**Owns:** Jira OAuth, sync, webhooks, write-back  
**Source docs:**  
- [../integrations/JIRA_INTEGRATION.md](../integrations/JIRA_INTEGRATION.md)  

**Deliverables:** `BoardConnector` interface + Jira adapter; sync worker  

**Depends on:** WS-A auth for storing connections  

---

### WS-C — AI orchestration

**Owns:** job queue, token budgets, completion targets, artifact packaging  
**Source docs:**  
- [../ai/AI_DELEGATION.md](../ai/AI_DELEGATION.md)  
- [../ai/MODEL_PLATFORM_CONFIG.md](../ai/MODEL_PLATFORM_CONFIG.md)  

**Deliverables:** orchestrator service; must invoke PII firewall before any model call  

**Depends on:** WS-A firewall interface; WS-B write-back client  

---

### WS-D — Cloud adapters

**Owns:** AWS / Azure / GCP / private storage & execution adapters  
**Source docs:**  
- [../integrations/CLOUD_CUSTOMIZATION.md](../integrations/CLOUD_CUSTOMIZATION.md)  

**Deliverables:** `CloudAdapter` interface + at least one provider MVP  

**Depends on:** WS-A secrets/KMS patterns  

---

### WS-E — MCP gateway

**Owns:** tool allowlists, MCP client, attachment pipeline  
**Source docs:**  
- [../integrations/MCP_INTEGRATIONS.md](../integrations/MCP_INTEGRATIONS.md)  

**Deliverables:** `McpGateway`; deny-by-default tests  

**Depends on:** WS-A PII scan on tool outputs; WS-C job context  

---

### WS-F — Web control plane

**Owns:** web app for policies, boards, audit, dashboards  
**Source docs:**  
- [../platforms/WEB_PLATFORM.md](../platforms/WEB_PLATFORM.md)  
- [../VISION.md](../VISION.md)  

**Deliverables:** responsive web MVP wired to API  

**Depends on:** API contracts from WS-A/B/C  

---

### WS-G — Mobile triage

**Owns:** swipe UX, manager notifications  
**Source docs:**  
- [../platforms/MOBILE_APP.md](../platforms/MOBILE_APP.md)  
- [../ai/AI_DELEGATION.md](../ai/AI_DELEGATION.md)  

**Deliverables:** iOS/Android triage MVP  

**Depends on:** WorkItem + policy APIs  

---

### WS-H — Solutions, custom models & skills

**Owns:** call-set → Solution promotion; custom model registry; skill packs  
**Source docs:**  
- [../ai/SOLUTIONS.md](../ai/SOLUTIONS.md)  
- [../ai/MODELS_AND_SKILLS.md](../ai/MODELS_AND_SKILLS.md)  

**Deliverables:**  
- Promote only when approved **and** merged  
- Sandbox train / publish APIs using Solutions only  
- Shared types + audit events; later web corpus UI  

**Must not:** train on uncleared drafts or unmerged call sets  

**Depends on:** WS-A audit/PII rules; WS-C job artifacts for call-set content  

---

## Suggested first parallel batch

After shared schemas exist:

| Agent | Workstream | First task |
|-------|------------|------------|
| 1 | WS-A | PII detector + redact API |
| 2 | WS-B | Jira issue fetch + comment post |
| 3 | WS-C | AiJob state machine + budget guard |
| 4 | WS-F | Auth’d web shell + policy forms stub |
| 5 | WS-H | Solution promote gate + sandbox train/publish |

Then: WS-D, WS-E, WS-G.

## Definition of done for a workstream slice

- Matches owning MD requirements  
- Does not bypass security layers  
- Updates its MD if behavior intentionally changes  
- Includes tests for happy path + one abuse case  
- Leaves a short `NOTES.md` in its package if decisions were made  

## Conflict resolution

If two agents need the same interface change: update the shared schema PR first, then continue. Prefer **narrow interfaces** over shared god-objects.

## Prompt template for spawning an agent

```text
You are implementing workstream <WS-ID> for 100x.
Read docs/agents/AGENT_HANDOFF.md and your source docs listed there.
Follow docs/FOUNDATION.md constraints.
Do not implement other workstreams.
Security and PII gates are mandatory.
Deliver: <specific deliverable>.
```
