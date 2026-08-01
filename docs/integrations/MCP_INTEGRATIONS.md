# MCP Integrations

AplifyAI uses **MCP (Model Context Protocol)** so each customer system can be connected **one-by-one**. Permissions are chosen at connect time (`read` / `write` / `admin`); the **provider MCP server** still enforces the signed-in user’s real ACLs.

## Which catalog services have an MCP option?

See the registry: [`shared/mcpProviders.ts`](../../shared/mcpProviders.ts).

| Availability | Services |
|---|---|
| **Official remote** | Jira, Confluence, Bitbucket (Atlassian), Notion, GitHub, GitHub Projects, AWS |
| **Official / self-hosted** | GitHub Enterprise |
| **Community / vendor MCP** | Linear, GitLab (+ self-managed + boards), Slack, Teams, Azure DevOps, Azure Repos, Azure, GCP, Google Drive, Outlook, Gmail |
| **Bridge** | Cursor / agent kits |
| **No MCP yet** | Smartsheet, Planview, Monday, ServiceNow, Asana, Trello, ClickUp, Wrike, Shortcut, Rally, Discord, Zoom, Webex, Mattermost, Rocket.Chat, RingCentral, Google Chat, Gerrit, Perforce, Gitea, CodeCommit, SharePoint, identity providers |

Those “no MCP yet” rows stay in onboarding for stack mapping; Connect stays disabled until a server exists.

## Connect flow (customer)

1. Finish onboarding → selected services land on **Connections**.
2. For each MCP-capable service: **Connect MCP** → choose **read / write / admin**.
3. AplifyAI stores granted **tool names** (demo; no secrets) and updates the org MCP allowlist.
4. Repeat until every selected MCP provider is connected.

API:

- `GET /api/v1/mcp/providers`
- `GET /api/v1/mcp/connections`
- `POST /api/v1/mcp/connections/:serviceId` `{ permissionLevel }`
- `DELETE /api/v1/mcp/connections/:serviceId`
- `POST /api/v1/mcp/connections/:serviceId/tools/:tool` (allowlist check; stub result today)

## Why MCP

- Tickets alone lack repo, docs, and runtime context  
- Enterprises already expose tools via MCP-style servers  
- Allowlists let us grant only safe tools per tenant  

## Tool policy

```yaml
mcpPolicy:
  default: deny
  allow:
    - server: jira
      tools: [jira_get_issue, jira_search]
    - server: github
      tools: [github_get_file, github_search_code]
  maxCallsPerJob: 50
  maxPayloadBytesPerCall: 200000
```

High-risk mutating tools require `write`/`admin` at connect time **and** may still need manager approval via platform policy.

## Attachment flow

```text
MCP tool result → size/type check → PII firewall → AI context and/or board attachment
```

## Security rules

- MCP credentials live in vault / IdP; never in prompts (demo stores metadata only)  
- Tool results are untrusted input (prompt-injection surface)  
- Provider MCP + OAuth scopes are the source of truth for end-user ACLs  
- Log every tool name, latency, and bytes (not raw secrets)  

## Implementation status

| Layer | Status |
|---|---|
| Provider registry + permission bands | Done (`shared/mcpProviders.ts`) |
| Demo connect / disconnect / allowlist sync | Done (`backend/src/mcp/gateway.ts`, Connections UI) |
| Remote HTTP JSON-RPC client | Done (`backend/src/mcp/remoteClient.ts`) — used when `MCP_*` env is set; falls back to stub |
| SSE response parsing | Done (`backend/src/mcp/sse.ts`) |
| Atlassian OAuth (PKCE + callback + Connections UI) | Done — `/mcp/oauth/atlassian/*`; token in-process or `MCP_ATLASSIAN_ACCESS_TOKEN` |
| Orchestrator `enriching_mcp` | Done — pulls connected provider context before `running` |

## Phased rollout

| Phase | MCP packs |
|-------|-----------|
| M1 | Jira + GitHub/GitLab read tools (live transport) |
| M2 | Confluence / Notion |
| M3 | Slack / Teams + cloud read |
| M4 | Controlled write tools (PR create, comments) |

Related: [JIRA_INTEGRATION.md](JIRA_INTEGRATION.md), [../security/SECURITY.md](../security/SECURITY.md), [OKTA_SSO.md](OKTA_SSO.md).
