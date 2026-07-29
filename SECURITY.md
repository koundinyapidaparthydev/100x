# Security Policy

## Supported versions

Security fixes are applied to the default development branch (`main`) of this proprietary repository.

## Reporting a vulnerability

**Do not** open a public GitHub issue for security vulnerabilities.

Please report suspected vulnerabilities privately to the repository maintainers (for example via a private channel already used for this project, or GitHub’s private vulnerability reporting if enabled on the repository).

Include:

- A short description of the issue and impact
- Steps to reproduce or a proof of concept (non-destructive)
- Affected package paths (`backend`, `web`, `mobile`, `shared`) if known
- Whether the issue involves PII leakage, auth/RBAC bypass, or secret exposure

You should receive an acknowledgement when the report is received. Please give maintainers reasonable time to investigate and remediate before any disclosure.

## Out of scope for this file

Product security architecture (PII firewall layers, audit requirements, etc.) is documented in [`docs/security/SECURITY.md`](docs/security/SECURITY.md). This file is only for **vulnerability reporting**.

## Secrets and local development

- Never commit real credentials. Use `*.env.example` files as templates.
- Prefer sandbox adapters (default) for local work and CI.
- Live Jira / OpenAI credentials belong only in local or deployment secret stores, never in the client bundle.
