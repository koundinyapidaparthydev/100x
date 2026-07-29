# Customization Matrix

Single reference for **who can change what**. Detailed behavior lives in the linked docs.

## Roles

| Role | Scope |
|------|--------|
| Founder | Org-wide locks and minimums |
| Employer | Projects / teams under the org |
| Manager | Ticket triage and approvals |
| Employee | Personal prefs within allowlists |
| Auditor | Read-only |

## Knobs

| Knob | Founder | Employer | Manager | Employee | Doc |
|------|---------|----------|---------|----------|-----|
| Security level (layers) | Set min / lock | Within min | View | View | [SECURITY.md](security/SECURITY.md) |
| PII categories | Set min | Project map | Approve blocks | View | [PII_RESTRICTIONS.md](security/PII_RESTRICTIONS.md) |
| Cloud storage / execution | Connect + lock | Select approved | View | View | [CLOUD_CUSTOMIZATION.md](integrations/CLOUD_CUSTOMIZATION.md) |
| Public vs private GenAI | Allowlist | Select | View | Prefer within list | [MODEL_PLATFORM_CONFIG.md](ai/MODEL_PLATFORM_CONFIG.md) |
| Model catalog | Approve | Subset | Ticket pick if unlocked | Prefer | [MODEL_PLATFORM_CONFIG.md](ai/MODEL_PLATFORM_CONFIG.md) |
| Platform / kit runtime | Approve | Project default | — | Kit override if allowed | [MODEL_PLATFORM_CONFIG.md](ai/MODEL_PLATFORM_CONFIG.md) |
| Code override mode | Lock max | Project mode | Approve high risk | Use if allowed | [MODEL_PLATFORM_CONFIG.md](ai/MODEL_PLATFORM_CONFIG.md) |
| Token budgets | Org caps | Project caps | Ticket bump within cap | View | [AI_DELEGATION.md](ai/AI_DELEGATION.md) |
| AI completion % target | Defaults | Project default | Per ticket | Suggest | [AI_DELEGATION.md](ai/AI_DELEGATION.md) |
| AI-first vs human-first | Org default | Project default | Swipe / toggle | — | [MOBILE_APP.md](platforms/MOBILE_APP.md) |
| MCP tool allowlist | Org deny/allow | Project subset | Approve mutating | — | [MCP_INTEGRATIONS.md](integrations/MCP_INTEGRATIONS.md) |
| Board field maps | — | Configure | — | — | [JIRA_INTEGRATION.md](integrations/JIRA_INTEGRATION.md) |
| Swipe gesture mapping | Org | — | — | — | [MOBILE_APP.md](platforms/MOBILE_APP.md) |

## Lock rule

Anything marked **lock** by Founder cannot be weakened by lower roles. Strengthening (stricter PII, lower token caps) is always allowed downward.
