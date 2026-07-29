# Product Vision

## One-line pitch

OffshoreHelper is an AI-first delegation platform that completes a configurable portion of board work before humans, with enterprise-grade security, PII firewalls, and full control over models, clouds, and token budgets.

## Problem

Companies already run distributed delivery (offshore India, US, Australia, etc.) through Jira and similar boards. Engineers often use AI privately to understand tickets. That creates:

- Inconsistent quality and context  
- Uncontrolled token spend and model choice  
- PII / customer data leaking into public AI tools  
- Managers with no visibility into what AI already did  
- Duplicate human effort on work AI could have started  

## Solution

Put a governed AI layer **in front of** human assignment:

1. Ticket lands on the board.  
2. Policy or manager decides: AI-first or human-first.  
3. AI pulls context via MCP / board APIs (description, comments, attachments metadata, linked issues).  
4. PII and restricted fields are stripped or masked before any model call.  
5. AI produces a bounded deliverable (analysis, plan, draft code, tests, bug notes) toward a target completion % (e.g. 10 / 20 / 30).  
6. Output is attached back to the ticket and audit-logged.  
7. Human assignee continues from a warmer start.  

## Goals

| Goal | Success signal |
|------|----------------|
| Reduce human grunt work on tickets | Measurable drop in time-to-first-meaningful-progress |
| Govern AI usage | Org policies for model, cloud, tokens, and code override |
| Protect customer data | PII never sent to AI by default; policy-enforced |
| Earn enterprise trust | Multi-layer security + customer-owned / private cloud options |
| Manager speed | Mobile swipe triage for AI-first vs human-first |
| Scale from small projects to large orgs | Multi-tenant + bring-your-own-cloud |

## Non-goals (near term)

- Replacing Jira / boards as the system of record  
- Fully autonomous end-to-end shipping without humans  
- Desktop application (web + mobile first)  
- Forcing one public LLM for all customers  

## Customization axes

Every major decision is a policy knob owned by founder / employer / employee (with precedence rules):

- AI-first on/off per ticket, project, or org  
- Target AI completion percentage  
- Model provider and model ID  
- Platform / runtime (Cursor-like kits, agent runners, etc.)  
- Public cloud vs private / VPC / customer cloud  
- Token budget per ticket / project / org  
- Whether AI may override code in the working kit  
- Security level (layers enabled)  
- PII categories blocked from AI  
- Attachment / MCP tool allowlists  

## Differentiation

| Typical “AI for tickets” | OffshoreHelper |
|--------------------------|----------------|
| Engineer pastes into ChatGPT | Governed pipeline before assignment |
| No PII controls | Dedicated PII firewall |
| One cloud / one model | Multi-cloud + private options |
| No manager UX | Mobile swipe + web control plane |
| Opaque spend | Token budgets and audit trails |

## Long-term north star

A company can run a large share of routine board work through AI under their own security and cloud constraints, with humans focused on judgment, architecture, and final delivery — across web and mobile, and eventually desktop.
