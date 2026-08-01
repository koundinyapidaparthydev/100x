# PII Restrictions & AI Firewall

Customers require that **personally identifiable information (PII) and sensitive customer data never reach AI agents** unless an explicit, audited policy allows it. This doc defines the firewall that sits in front of every model call.

## Principle

> Default deny for PII toward AI. Humans on the board may still see full ticket content per their Jira permissions; AI receives only a sanitized work packet.

## Restricted categories (v1)

At minimum, detect and handle:

| Category | Examples | Default AI action |
|----------|----------|-------------------|
| Email addresses | `user@company.com` | Redact |
| Phone numbers | `+1-555-0100`, local formats | Redact |
| Payment data | Full PAN, CVV; last 4 digits of cards | Block or redact (configurable; default **block** for full PAN / CVV; redact last-4) |
| Customer identifiers | Account IDs, loyalty IDs if marked sensitive | Redact |
| Names of end customers | When tagged / field-mapped as PII | Redact |
| Addresses | Postal / street | Redact |
| Auth secrets | API keys, tokens, passwords in ticket text | **Block** job until removed |
| Government IDs | SSN / national ID patterns | **Block** |

“Last project” and similar customer history fields are **policy-mapped**: if a Jira custom field is marked `pii=true` or `ai_forbidden=true`, strip it from AI context entirely.

## Modes

Per category (org / project override):

1. **`redact`** — clear the value using a configured style (see below) before the model call  
2. **`block`** — refuse to start AI job; notify manager  
3. **`hash`** — irreversible token for correlation without revealing value  
4. **`allow`** — only if founder enables (rare; audited)  

### Redaction styles (when mode is `redact`)

Configurable in **Governance → PII & PCI clearing**:

| Style | Example | Typical use |
|-------|---------|-------------|
| `placeholder` | `[EMAIL_1]`, `[PHONE_1]` | Structure-preserving tokens |
| `fixed` | `user@cleared.invalid` | Replace every email (or other value) with one cleared stand-in |
| `mask_keep_last` | `***-***-0132`, `**** **** **** 1111` | Phone / card / SSN — keep last N digits |
| `mask_keep_domain` | `***@acme.com` | Emails — drop local-part, keep domain |

Default org seed: email → fixed `user@cleared.invalid`; phone → last 4; SSN / full PAN → block; customer names → hash.

## Pipeline position

```text
Board payload → Field policy map → Detector → Redactor → Sanitized packet → Model
                                      ↓
                                 Audit decision
```

No parallel path may skip this pipeline.

## Inputs scanned

- Issue summary, description, comments  
- Custom fields marked for AI  
- Attachment **names** always; attachment **content** only if type allowlisted (e.g. `.md`, `.txt`, selected code)  
- MCP tool outputs before they are merged into prompts  

## Outputs

- AI must not echo raw PII back into board comments if it somehow appeared (secondary scan on write-back).  
- Artifacts stored in customer cloud remain subject to retention policy; redacted copies used for model training are **never** retained by default.

## Configuration UX

Founder / employer settings (**Governance → PII & PCI clearing**):

- Per category: mode (redact / block / hash / allow)  
- When redact: choose clearing style + fixed value or digits to keep  
- Edit the customer-name list used by the name detector  
- Map Jira fields → PII / forbidden (planned)  
- Require manager approval when block triggers  

Employee cannot weaken org minimums.

## Testing requirements

- Golden fixtures for emails, phones, cards, mixed languages, obfuscated patterns (`j ohn@x.com`, `555.123.4567`)  
- Prompt-injection cases trying to exfiltrate PII via “ignore previous instructions”  
- Regression: AI job API returns `422 PII_BLOCKED` when secrets present  

## Compliance narrative (sales / trust)

We tell customers:

1. AI never sees raw restricted fields by default.  
2. Decisions are logged.  
3. Execution can stay in their cloud.  
4. They control categories and severity.  

Implementation details belong with Layer 5 in [SECURITY.md](SECURITY.md).
