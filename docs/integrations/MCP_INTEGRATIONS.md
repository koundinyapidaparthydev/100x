# MCP Integrations

AplifyAI uses **MCP (Model Context Protocol) tools** to gather context and produce attachments without hard-coding every integration into the model prompt.

## Why MCP

- Tickets alone lack repo, docs, and runtime context  
- Enterprises already expose tools via MCP-style servers  
- Allowlists let us grant only safe tools per tenant  

## Responsibilities

1. Discover configured MCP servers for the tenant/project  
2. Authorize tool calls under policy  
3. Fetch context (issues, files metadata, docs, CI summaries)  
4. Pass **sanitized** tool results into the AI runner  
5. Attach selected outputs back to the board  

## Tool policy

```yaml
mcpPolicy:
  default: deny
  allow:
    - server: jira
      tools: [get_issue, search_issues]
    - server: repo
      tools: [read_file, search_code]
  deny:
    - server: repo
      tools: [force_push, delete_repo]
  maxCallsPerJob: 50
  maxPayloadBytesPerCall: 200000
```

High-risk mutating tools require `platformPolicy` code-override mode and may need manager approval.

## Attachment flow

```text
MCP tool result → size/type check → PII firewall → AI context and/or board attachment
```

Examples of attachable artifacts:

- Extracted requirements  
- Relevant code snippets (redacted)  
- Test run summaries  
- Architecture notes from Confluence/docs MCP  

## Security rules

- MCP credentials live in vault; never in prompts  
- Tool results are untrusted input (prompt-injection surface)  
- Strip HTML/scripts from doc tools  
- Log every tool name, latency, and bytes (not raw secrets)  

## Phased rollout

| Phase | MCP packs |
|-------|-----------|
| M1 | Jira + read-only repo |
| M2 | Docs / Confluence / Notion-style |
| M3 | CI / observability (read-only) |
| M4 | Controlled write tools (PR create, branch) |

## Agent notes

- Implement a single `McpGateway` that all AI jobs use  
- Unit-test deny-by-default  
- Do not let the model invent tool names outside the allowlist  

Related: [JIRA_INTEGRATION.md](JIRA_INTEGRATION.md), [../security/SECURITY.md](../security/SECURITY.md).
