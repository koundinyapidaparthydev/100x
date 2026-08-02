# Security Model

Security is the **top priority**. Enterprise customers will only adopt AplifyAI if we can prove their code, tickets, and customer data stay safe — including when AI runs.

## Promise to customers

> Your data is safe. Your content is safe. You choose where it runs, who sees it, and what AI is allowed to touch.

We communicate this with clear layers, customer-selectable security levels, and optional private / customer-owned cloud execution.

## Six security layers

Layers are cumulative. Customers pick a **security level** that enables layers 1–N (minimum recommended: all six for enterprise).

### Layer 1 — Transport & edge protection

- TLS 1.2+ everywhere
- WAF + DDoS protection on public endpoints
- Strict CORS, security headers (HSTS, CSP)
- Rate limiting per tenant / IP / client

**Failure mode if skipped:** interception, abuse, scraping.

### Layer 2 — Identity & access control

- SSO (OIDC) for enterprise: Okta, Microsoft Entra ID, Google Workspace
- Social sign-in: Continue with Google, Continue with Apple
- MFA for privileged roles
- RBAC: Root / Manager / Engineer / Auditor / Service
- Least privilege; short-lived tokens
- Session revocation and device awareness on mobile

**Failure mode if skipped:** unauthorized policy or ticket access.

### Layer 3 — Tenant & data isolation

- Logical (and optionally physical) tenant isolation
- Separate encryption keys per tenant where possible
- Row-level / namespace isolation in DB and object storage
- No cross-tenant queries in app code paths

**Failure mode if skipped:** data bleed between companies.

### Layer 4 — Secrets, encryption & key management

- Secrets in vault (AWS KMS / Azure Key Vault / GCP KMS / HashiCorp / customer KMS)
- Encryption at rest for tickets cache, artifacts, configs
- Field-level encryption for sensitive policy fields
- Customer-managed keys (CMK) option

**Failure mode if skipped:** credential theft, disk exposure.

### Layer 5 — AI data firewall (PII + content policy)

- Mandatory pre-model sanitization
- Block / redact PII categories (see [PII_RESTRICTIONS.md](PII_RESTRICTIONS.md))
- Prompt construction only from sanitized packets
- Tool/MCP allowlists; deny by default for high-risk tools
- Optional: no retention on model provider; private model endpoints

**Failure mode if skipped:** customer PII and secrets leak to AI providers.

### Layer 6 — Runtime integrity, audit & continuous assurance

- Immutable audit logs (who, what, when, tokens, model, cloud, PII decisions)
- Signed / checksummed artifacts where feasible
- Anomaly detection on token spikes and unusual cloud usage
- Vulnerability scanning, dependency pinning, SBOM
- Optional: bug-finding / flow-optimization agents run only under policy
- Penetration test cadence for enterprise tiers

**Failure mode if skipped:** no proof of safety; silent misuse.

## Customer-selectable security levels

| Level | Layers | Typical use |
|-------|--------|-------------|
| `standard` | 1–4 | Early pilots, non-sensitive projects |
| `elevated` | 1–5 | Default for production SaaS tenants |
| `enterprise` | 1–6 | Regulated / large companies |
| `custom` | Toggle each layer + extras | Customer-defined |

Founders can lock a **minimum** level so employees cannot weaken org policy.

## Data residency & execution placement

Customers choose where AI and storage run:

- AplifyAI managed region
- Customer AWS account
- Customer Azure subscription
- Customer GCP project
- Customer private cloud / on-prem style VPC (AWS, Azure, GCP, NVIDIA, or other named platform)

Policy must record: **store code where?** **run AI where?** These can differ (e.g. artifacts in customer S3, inference on private endpoint).

## Code override safety

If employees may override code in their kit:

- Requires explicit policy grant
- Diffs audited
- Optional approval gate for managers
- Never bypasses PII firewall when feeding AI

## Threats we explicitly design against

- Prompt injection from ticket text / attachments
- Exfiltration via MCP tools
- Insider misuse of admin tokens
- Supply-chain compromise of agent runners
- Accidental logging of secrets or PII

## Implementation notes for agents

- Treat Layer 5 as a hard gate in the orchestrator, not a best-effort filter.
- Security tests must run in CI for redaction and isolation.
- Never merge features that call a model without going through the firewall interface.

Related: [PII_RESTRICTIONS.md](PII_RESTRICTIONS.md), [../integrations/CLOUD_CUSTOMIZATION.md](../integrations/CLOUD_CUSTOMIZATION.md).
