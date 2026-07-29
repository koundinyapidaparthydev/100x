# Web Platform

Primary control plane for OffshoreHelper. **No desktop app in v1** — web covers configuration, monitoring, and deep ticket review.

## Goals

- Let founders/employers configure security, cloud, models, PII, and token budgets  
- Connect boards (Jira first)  
- Inspect AI jobs, artifacts, and audit trails  
- Support employees reviewing AI drafts in a browser  

## Primary audiences

| Role | Web jobs |
|------|----------|
| Founder | Org locks, security level, cloud connectors, billing/tokens |
| Employer / Manager | Project policies, triage, approvals |
| Employee | View AI package, open artifacts, acknowledge hand-off |
| Auditor | Read-only audit and compliance exports |

## Information architecture (v1)

1. **Dashboard** — jobs in flight, PII blocks, token burn  
2. **Boards** — connected projects, sync health  
3. **Work items** — ticket detail, AI timeline, artifacts  
4. **Policies** — AI-first defaults, completion %, overrides  
5. **Models & platforms** — approved catalog  
6. **Cloud & security** — providers, layers, KMS  
7. **PII rules** — categories and field maps  
8. **Audit** — searchable security/AI events  
9. **Admin** — users, SSO, roles  

## UX principles

- Make security and PII status visible on every AI job (trust UI)  
- Prefer clear policy forms over hidden advanced toggles  
- Show “where this ran” (cloud + model) on every draft  
- Mobile is for triage speed; web is for depth  

## Technical direction

- Responsive web app (desktop + tablet browsers first)  
- Chrome and modern evergreen browsers supported  
- Auth via SSO + session; CSRF protections on mutations  
- Feature-flag incomplete enterprise modules  

## Out of scope (web v1)

- Full IDE editing inside the browser  
- Desktop-install packaging  
- Replacing Jira’s board UI entirely  

Related: [MOBILE_APP.md](MOBILE_APP.md), [../FOUNDATION.md](../FOUNDATION.md).
