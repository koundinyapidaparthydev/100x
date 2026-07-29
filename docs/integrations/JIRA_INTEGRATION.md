# Jira & Board Integration

Boards (starting with **Jira**) are the system of record for work. AplifyAI syncs tickets, runs AI under policy, and writes artifacts back.

## Goals

- Ingest issues, comments, statuses, assignees, labels, custom fields
- Preserve Jira permissions model for humans
- Attach AI outputs without destroying human workflow
- Support later boards (Canvas, others) behind the same `BoardConnector` interface

## Connection

1. Employer connects Jira Cloud / Data Center via OAuth 2.0 (preferred) or API token.
2. Select projects / boards in scope.
3. Map fields:
   - `aiFirst` (custom field or label)
   - `aiStatus`
   - `aiCompletionTarget`
   - PII / forbidden field flags
4. Webhook + periodic reconciliation.

## Sync model

| Direction | Data |
|-----------|------|
| Jira → AplifyAI | Issue CRUD, comments, attachment metadata, transitions |
| AplifyAI → Jira | AI summary comments, artifact attachments, custom field updates, optional transition to “AI Draft Ready” |

Conflict rule: Jira wins for human assignee and workflow state unless AplifyAI owns a dedicated AI status field.

## Ticket lifecycle mapping

```text
Jira Created/Updated
  → WorkItem upsert
  → Policy evaluate (AI-first?)
  → If yes: enqueue AiJob
  → On complete: comment + attach + set aiStatus
  → Human continues in Jira as usual
```

Manager swipe on mobile updates AplifyAI policy for that WorkItem and may set a Jira label/`aiFirst` field.

## Attachments

- Download allowlisted types for MCP/AI context only after PII scan
- Upload AI artifacts as Jira attachments with clear naming: `aplifyai-ai-{jobId}-summary.md`, `aplifyai-ai-{jobId}.patch`
- Virus / malware scan before ingest when possible

## Permissions

- Connector uses a dedicated Jira service account with least project permissions
- AplifyAI still enforces its own RBAC; Jira access ≠ AplifyAI admin

## Error handling

- Soft-fail write-back with retry queue
- Surface sync errors in web control plane
- Never lose audit of AI job if Jira is temporarily down (store artifacts in configured cloud)

## Future boards

`BoardConnector` methods:

- `listProjects`, `getIssue`, `upsertComment`, `addAttachment`, `updateFields`, `subscribeWebhooks`

Canvas / other platforms implement the same interface.

Related: [MCP_INTEGRATIONS.md](MCP_INTEGRATIONS.md), [../ai/AI_DELEGATION.md](../ai/AI_DELEGATION.md).
