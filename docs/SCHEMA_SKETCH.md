# Shared Schema Sketch

Draft contracts for foundation. Agents should turn these into real types (OpenAPI / Zod / protobuf) before diverging.

## WorkItem

```yaml
id: string
tenantId: string
board: { type: jira, projectId: string, issueKey: string, issueId: string }
title: string
status: string
assigneeExternalId: string | null
labels: [string]
aiFirst: boolean
targetCompletionPercent: 10 | 20 | 30 | number
aiStatus: none | queued | running | ready_for_human | blocked_pii | failed | cancelled
lastAiJobId: string | null
```

## Policy

```yaml
id: string
tenantId: string
scope: org | project | ticket
securityLevel: standard | elevated | enterprise | custom
pii: { category: PiiCategoryRule }  # mode: redact|block|hash|allow; style: placeholder|fixed|mask_keep_last|mask_keep_domain; fixedReplacement?; keepLastDigits?
customerNames: [string]             # end-customer names matched as PII
cloud: CloudPolicy          # see CLOUD_CUSTOMIZATION.md
model: { provider, modelId, endpoint? }
platform: { runtime, codeOverrideMode }
tokenBudget: { maxTotalTokens, maxCostUsd?, onExhaustion }
mcpAllowlist: [ { server, tools: [string] } ]
aiFirstDefault: boolean
targetCompletionPercentDefault: number
locks: { models: boolean, securityMin: boolean, cloud: boolean }
```

## AiJob

```yaml
id: string
workItemId: string
tenantId: string
state: queued | sanitizing | enriching_mcp | running | packaging | attaching | ready_for_human | blocked_pii | failed | cancelled
model: { provider, modelId }
cloudExecution: { provider, mode, region }
tokenUsage: { input: number, output: number, total: number }
artifacts: [ArtifactRef]
piiReport: { redactions: number, blocks: [string] }  # no raw PII
error: string | null
createdAt: datetime
finishedAt: datetime | null
```

## Artifact

```yaml
id: string
aiJobId: string
kind: summary | patch | test_stub | note | other
storage: { provider, uri }
checksum: string
boardAttachmentId: string | null
```

## AuditEvent

```yaml
id: string
tenantId: string
actor: { type: user | system | manager_mobile, id: string }
action: string
resource: { type: string, id: string }
securityLayersApplied: [1, 2, 3, 4, 5, 6]
metadata: object   # never store secrets or raw PII
createdAt: datetime
```

## Hard rules

- Every `AiJob` transition emits `AuditEvent`  
- `AiJob` cannot enter `running` without a successful sanitizing step  
- Storage URIs must respect tenant cloud policy  
