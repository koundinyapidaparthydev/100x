# Mobile Application

Managers need to **triage fast**. The mobile app is not a full admin console; it is a decision surface for AI-first delegation and lightweight monitoring.

## Why mobile

- Managers are often away from desks  
- Swipe gestures make AI-first / human-first decisions cheap  
- Push notifications when AI drafts are ready or PII blocks fire  

## Core gesture model

On a ticket card in the triage queue:

| Gesture | Default meaning (customizable) |
|---------|--------------------------------|
| **Swipe right** | Send / confirm **AI-first** |
| **Swipe left** | Keep / send **human-first** (skip AI) |
| Tap | Open ticket summary + AI status |
| Long-press | Quick policy overrides (if unlocked) |

Founders can invert or remap gestures in org settings.

## Screens (v1)

1. **Login / SSO**  
2. **Triage queue** — swipe deck filtered by project  
3. **Ticket detail** — summary, AI target %, current assignee proposal  
4. **AI status** — queued / running / ready / blocked  
5. **Approvals** — high-risk override or mutating MCP approvals (workspace owners decide; others read-only)  
6. **PII blocks** — view blocked work + request policy review (does not edit rules)  
7. **Notifications**  
8. **Account** — read-only connections pulse  

Deep configuration (cloud keys, full PII maps, models, budgets) stays on **web Governance**. Mobile `PATCH /policies` is rejected (403).

## Customizations managers care about

- Per-ticket AI on/off via swipe  
- Target completion % presets (10 / 20 / 30)  
- See token budget remaining for the project  
- Choose assignee after AI completes (optional)  

## Security on mobile

- MFA for managers  
- Short-lived tokens; biometric unlock where OS allows  
- No caching of raw PII payloads on device beyond OS-secure storage needs  
- Remote session revoke from web admin  

## Platforms

- iOS and Android (shared codebase preferred, e.g. React Native / Flutter — choose in foundation)  
- No offline mutation of security policies  

## Non-goals

- Full Jira board replacement  
- Editing large code artifacts on phone  
- Desktop parity  
- Editing org or per-environment board controls (PII, models, cloud, budgets, MCP credentials)  

Related: [WEB_PLATFORM.md](WEB_PLATFORM.md), [../ai/AI_DELEGATION.md](../ai/AI_DELEGATION.md).
