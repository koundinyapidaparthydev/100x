# MCP Integrations

100x is an **MCP client**: it connects to **vendor-hosted MCP servers** (or customer-hosted bridges). It does not invent fake vendor MCP servers. Auth follows each vendor — OAuth, PAT/API key, or IAM.

Connect is **honest**: no “Connected (live)” without credentials. Tenant auth is primary; platform env is a fallback. Connect must not stay **Unavailable** solely because platform env is unset for token/OAuth-capable providers.

## Which catalog services have an MCP option?

See the registry: [`shared/mcpProviders.ts`](../../shared/mcpProviders.ts).

| Availability | Services |
|---|---|
| **Official remote** | Jira, Confluence, Bitbucket (Atlassian), Notion, GitHub, GitHub Projects, Linear, GitLab.com, AWS |
| **Official / self-hosted** | GitHub Enterprise |
| **Community / vendor MCP** | Slack, Teams, Azure, GCP, Google Drive, Outlook, Gmail, GitLab self-managed |
| **Logging / observability** | Datadog, AWS CloudWatch, Splunk, Elasticsearch/OpenSearch, New Relic, Grafana Loki |
| **Bridge** | Cursor / agent kits; Azure DevOps / Azure Repos (`microsoft/azure-devops-mcp`) |
| **No MCP yet** | Smartsheet, Planview, Monday, ServiceNow, Asana, Trello, ClickUp, Wrike, Shortcut, Rally, Discord, Zoom, Webex, Mattermost, Rocket.Chat, RingCentral, Google Chat, Gerrit, Perforce, Gitea, CodeCommit, SharePoint, identity providers |

Those “no MCP yet” rows stay in onboarding for stack mapping; Connect stays disabled until a server exists.

## Auth matrix

| Style | Providers | Connect UX |
|---|---|---|
| **OAuth** | Jira, Confluence, Bitbucket; Slack; Teams; Outlook; Gmail; Google Drive; GitLab.com | Authorize button → callback → per-tenant token |
| **PAT / API key** | GitHub (+ Enterprise / Projects); Notion; Linear (API key); GitLab self-managed; Datadog; Splunk; Elasticsearch; New Relic; Grafana Loki; Azure DevOps / Repos | Generic token modal → `PUT /mcp/credentials/:serviceId` |
| **IAM / role** | AWS, AWS CloudWatch, GCP, Azure | Role ARN / project / subscription modal |
| **Bridge** | Cursor | Never fake Connected — requires `MCP_CURSOR_BRIDGE_URL` |

## Connect flow (customer)

1. Finish onboarding **or** open **Connections → Add connection**.
2. **Connect MCP** → choose **read / write / admin**.
3. Auth gates:
   - **Atlassian**: `409 oauth_required` → Authorize Atlassian (PKCE). Staging needs `MCP_ATLASSIAN_CLIENT_ID` / `CLIENT_SECRET` / `REDIRECT_URI` on Cloud Run.
   - **Token providers**: `409 token_required` → paste token → `PUT /mcp/credentials/:serviceId`. Env `MCP_*_TOKEN` is a fallback.
   - **OAuth packs** (Slack / GitLab / Microsoft / Google / Linear OAuth): `409 oauth_required` → Authorize when `MCP_<FAMILY>_CLIENT_ID` + `REDIRECT_URI` are set.
   - **IAM**: `409 token_required` → link role/project/subscription.
   - **Logging without MCP URL**: after token, `400 transport_unavailable` until `MCP_DATADOG_URL` (etc.) points at a bridge.
   - **Cursor**: always `transport_unavailable` until a real bridge URL is configured.
4. On success, `status: connected` and `live: true` when credentials + transport endpoint are ready. Secrets are **never** returned on `GET /mcp/connections`.
5. Badges: Ready / Needs authorize / Needs token / Needs IAM link / Connected (live) / Needs MCP URL / Bridge only.

## Default remote MCP URLs

| Provider | Default endpoint |
|---|---|
| Atlassian | `https://mcp.atlassian.com/v1/sse` |
| GitHub | `https://api.githubcopilot.com/mcp/` |
| Notion | `https://mcp.notion.com/mcp` |
| Linear | `https://mcp.linear.app/mcp` |
| GitLab.com | `https://gitlab.com/api/v4/mcp` |
| AWS / CloudWatch | `https://aws-mcp.us-east-1.api.aws/mcp` |
| Logging / Slack / Google / Microsoft | No public default — set `MCP_*_URL` |

Tenant bearer + default endpoint unlocks live for Notion / Linear / GitHub the same way GitHub PAT already did.

## API

- `GET /api/v1/mcp/providers`
- `GET /api/v1/mcp/transports`
- `GET /api/v1/mcp/credentials/status` — `{ atlassian, github, tokens, oauth, iam }` (no secrets)
- `PUT /api/v1/mcp/credentials/:serviceId` `{ token }` or IAM fields `{ roleArn, projectId, subscriptionId, … }`
- `PUT /api/v1/mcp/credentials/github` `{ token }` (legacy alias)
- `GET /api/v1/mcp/connections`
- `POST /api/v1/mcp/connections/:serviceId` `{ permissionLevel }` — may return `409` / `400` with `code`
- `POST /api/v1/mcp/connections/:serviceId/verify`
- `DELETE /api/v1/mcp/connections/:serviceId`
- `POST /api/v1/mcp/connections/:serviceId/tools/:tool`
- `GET /api/v1/mcp/oauth/status` — Atlassian + all OAuth packs
- `GET /api/v1/mcp/oauth/:provider/status|start|callback` — `atlassian` \| `linear` \| `gitlab` \| `slack` \| `microsoft` \| `google`

## Env (see `backend/.env.example`)

### Atlassian (staging ops — code already exists)

| Variable | Purpose |
|---|---|
| `MCP_ATLASSIAN_CLIENT_ID` / `CLIENT_SECRET` / `REDIRECT_URI` | OAuth PKCE — **required on staging Cloud Run for Authorize** |
| `MCP_ATLASSIAN_ACCESS_TOKEN` | Optional long-lived override |
| `MCP_ATLASSIAN_URL` | Remote MCP endpoint (default Rovo SSE URL) |

### Token / PAT fallbacks

`MCP_GITHUB_TOKEN`, `MCP_NOTION_TOKEN`, `MCP_LINEAR_TOKEN`, `MCP_GITLAB_TOKEN`, `MCP_DATADOG_API_KEY`, `MCP_SPLUNK_TOKEN`, `MCP_ELASTICSEARCH_TOKEN`, `MCP_NEW_RELIC_API_KEY`, `MCP_GRAFANA_TOKEN` / `MCP_LOKI_TOKEN`, `MCP_AZURE_DEVOPS_TOKEN`

### OAuth packs (env-gated `authorizeReady`)

| Family | Client env prefix |
|---|---|
| Linear | `MCP_LINEAR_CLIENT_*` / `MCP_LINEAR_REDIRECT_URI` |
| GitLab | `MCP_GITLAB_CLIENT_*` / `MCP_GITLAB_REDIRECT_URI` |
| Slack | `MCP_SLACK_CLIENT_*` / `MCP_SLACK_REDIRECT_URI` (+ `MCP_SLACK_URL` for MCP transport) |
| Microsoft (Teams/Outlook) | `MCP_MICROSOFT_CLIENT_*` / `MCP_MICROSOFT_REDIRECT_URI` (+ `MCP_MICROSOFT_URL`) |
| Google (Gmail/Drive) | `MCP_GOOGLE_MCP_CLIENT_*` / `MCP_GOOGLE_MCP_REDIRECT_URI` (+ `MCP_GOOGLE_URL`) |

### Cloud / IAM

| Variable | Purpose |
|---|---|
| `AWS_ROLE_ARN` / `MCP_AWS_URL` | AWS MCP |
| `GCP_PROJECT_ID` / `MCP_GCP_URL` | GCP MCP bridge |
| `AZURE_SUBSCRIPTION_ID` / `AZURE_TENANT_ID` / `MCP_AZURE_URL` | Azure MCP |
| `MCP_AZURE_DEVOPS_URL` | Hosted `microsoft/azure-devops-mcp` bridge |
| `MCP_CURSOR_BRIDGE_URL` | Real agent-kit bridge only |

`WEB_APP_ORIGIN` — OAuth callback redirect back to `/connections`.

## Azure DevOps bridge

There is no public SaaS MCP URL. Host [microsoft/azure-devops-mcp](https://github.com/microsoft/azure-devops-mcp) privately (stdio or HTTP), set `MCP_AZURE_DEVOPS_URL`, and paste a PAT in Connections.

## Cursor

Cursor is primarily an **MCP client**. 100x will not mark Cursor as Connected without `MCP_CURSOR_BRIDGE_URL` pointing at a documented bridge.

## Why MCP

- Tickets alone lack repo, docs, runtime, and ops context  
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
    - server: datadog
      tools: [datadog_search_logs, datadog_query_metrics]
  maxCallsPerJob: 50
  maxPayloadBytesPerCall: 200000
```

## Security rules

- MCP credentials live in the per-tenant credential store (or env / IdP); never in prompts or list responses  
- Tool results are untrusted input (prompt-injection surface)  
- Provider MCP + OAuth scopes / PAT scopes are the source of truth for end-user ACLs  
- Log every tool name, latency, and bytes (not raw secrets)  

## Implementation status

| Layer | Status |
|---|---|
| Provider registry + permission bands | Done |
| Honest connect / disconnect / allowlist sync | Done — OAuth / PAT / IAM / transport codes |
| Per-tenant credential persistence | Done (`tokensByServiceId`, `oauthByProvider`, `iamByServiceId`) |
| Remote HTTP JSON-RPC client | Done — tenant then env bearer |
| Atlassian OAuth (PKCE) | Done — staging needs client secrets |
| Generic token API + Connections modal | Done |
| OAuth scaffolding (Linear/GitLab/Slack/Microsoft/Google) | Done — env-gated authorizeReady |
| AWS/GCP/Azure IAM UX | Done |
| Azure DevOps / Cursor bridge honesty | Done |

Related: [JIRA_INTEGRATION.md](JIRA_INTEGRATION.md), [../security/SECURITY.md](../security/SECURITY.md), [OKTA_SSO.md](OKTA_SSO.md).
