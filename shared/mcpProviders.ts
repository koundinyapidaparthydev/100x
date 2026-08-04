/**
 * Registry of which onboarding services have an MCP server we can wire.
 *
 * Permissions are granted at connect time; the MCP server / IdP still enforces
 * the user's real ACLs. AplifyAI only stores which permission *level* the tenant
 * enabled and which tools that level exposes.
 */

import type { ServiceId } from './types';

export type McpAvailability =
  | 'official_remote'
  | 'official_local'
  | 'community'
  | 'bridge'
  | 'none';

export type McpAuthMode = 'oauth' | 'api_token' | 'pat' | 'iam_role';

/** Tenant-selected capability band when connecting a provider. */
export type McpPermissionLevel = 'read' | 'write' | 'admin';

export type McpToolDef = {
  name: string;
  description: string;
  minLevel: McpPermissionLevel;
  mutating?: boolean;
};

export type McpProviderDef = {
  serviceId: ServiceId;
  /** Stable MCP server id used in policy allowlists. */
  serverId: string;
  availability: McpAvailability;
  authMode: McpAuthMode;
  /** Demo/UI: can open Connect + grant a permission level. */
  connectable: boolean;
  permissionLevels: McpPermissionLevel[];
  tools: McpToolDef[];
  docsUrl?: string;
  notes?: string;
};

const LEVELS: McpPermissionLevel[] = ['read', 'write', 'admin'];

function tools(
  read: Array<[string, string]>,
  write: Array<[string, string]> = [],
  admin: Array<[string, string]> = [],
): McpToolDef[] {
  return [
    ...read.map(([name, description]) => ({ name, description, minLevel: 'read' as const })),
    ...write.map(([name, description]) => ({
      name,
      description,
      minLevel: 'write' as const,
      mutating: true,
    })),
    ...admin.map(([name, description]) => ({
      name,
      description,
      minLevel: 'admin' as const,
      mutating: true,
    })),
  ];
}

/** Providers that expose (or can expose) MCP tools AplifyAI can connect. */
export const MCP_PROVIDERS: McpProviderDef[] = [
  // —— Official / strong MCP ——
  {
    serviceId: 'jira',
    serverId: 'jira',
    availability: 'official_remote',
    authMode: 'oauth',
    connectable: true,
    permissionLevels: LEVELS,
    docsUrl: 'https://github.com/atlassian/atlassian-mcp-server',
    notes: 'Atlassian Rovo MCP — OAuth scopes honor the connecting user’s Jira ACLs.',
    tools: tools(
      [
        ['jira_get_issue', 'Read issue fields and comments'],
        ['jira_search', 'JQL search'],
        ['jira_list_projects', 'List accessible projects'],
      ],
      [
        ['jira_add_comment', 'Add a comment'],
        ['jira_transition', 'Transition issue status'],
        ['jira_update_fields', 'Update safe fields'],
      ],
      [['jira_admin_webhook', 'Manage webhooks']],
    ),
  },
  {
    serviceId: 'confluence',
    serverId: 'confluence',
    availability: 'official_remote',
    authMode: 'oauth',
    connectable: true,
    permissionLevels: LEVELS,
    docsUrl: 'https://github.com/atlassian/atlassian-mcp-server',
    notes: 'Same Atlassian remote MCP surface as Jira.',
    tools: tools(
      [
        ['confluence_get_page', 'Read a page'],
        ['confluence_search', 'Search spaces'],
      ],
      [
        ['confluence_create_page', 'Create a page'],
        ['confluence_update_page', 'Update a page'],
      ],
    ),
  },
  {
    serviceId: 'bitbucket',
    serverId: 'bitbucket',
    availability: 'official_remote',
    authMode: 'api_token',
    connectable: true,
    permissionLevels: ['read', 'write'],
    docsUrl: 'https://github.com/atlassian/atlassian-mcp-server',
    tools: tools(
      [
        ['bitbucket_list_prs', 'List pull requests'],
        ['bitbucket_read_file', 'Read file contents'],
      ],
      [
        ['bitbucket_create_pr', 'Open a pull request'],
        ['bitbucket_comment_pr', 'Comment on a PR'],
      ],
    ),
  },
  {
    serviceId: 'notion',
    serverId: 'notion',
    availability: 'official_remote',
    authMode: 'api_token',
    connectable: true,
    permissionLevels: LEVELS,
    docsUrl: 'https://developers.notion.com/docs/mcp',
    notes: 'Official Notion remote MCP — paste an integration token (tenant-scoped). Env MCP_NOTION_TOKEN is a fallback.',
    tools: tools(
      [
        ['notion_search', 'Search workspace'],
        ['notion_get_page', 'Read page markdown'],
      ],
      [
        ['notion_update_page', 'Edit page content'],
        ['notion_create_page', 'Create a page'],
      ],
    ),
  },
  {
    serviceId: 'github',
    serverId: 'github',
    availability: 'official_remote',
    authMode: 'pat',
    connectable: true,
    permissionLevels: LEVELS,
    notes: 'GitHub MCP — connect with a Personal Access Token (tenant-scoped). Env MCP_GITHUB_TOKEN is a fallback.',
    tools: tools(
      [
        ['github_get_file', 'Read repository file'],
        ['github_search_code', 'Search code'],
        ['github_list_prs', 'List pull requests'],
        ['github_get_issue', 'Read an issue'],
      ],
      [
        ['github_create_pr', 'Open a pull request'],
        ['github_create_issue', 'Create an issue'],
        ['github_comment', 'Comment on PR/issue'],
      ],
      [['github_admin_hooks', 'Manage webhooks']],
    ),
  },
  {
    serviceId: 'github_enterprise',
    serverId: 'github_enterprise',
    availability: 'official_local',
    authMode: 'pat',
    connectable: true,
    permissionLevels: LEVELS,
    notes: 'GHES / GHEC — same tool surface, private networking required.',
    tools: tools(
      [
        ['ghe_get_file', 'Read file'],
        ['ghe_search_code', 'Search code'],
        ['ghe_list_prs', 'List PRs'],
      ],
      [
        ['ghe_create_pr', 'Open PR'],
        ['ghe_comment', 'Comment'],
      ],
    ),
  },
  {
    serviceId: 'aws',
    serverId: 'aws',
    availability: 'official_remote',
    authMode: 'iam_role',
    connectable: true,
    permissionLevels: ['read', 'write'],
    docsUrl: 'https://docs.aws.amazon.com/aws-mcp/latest/userguide/what-is-mcp-server.html',
    notes: 'AWS-hosted MCP — IAM identity, no long-lived keys in AplifyAI.',
    tools: tools(
      [
        ['aws_describe_resources', 'Describe tagged resources'],
        ['aws_read_logs', 'Read CloudWatch log groups'],
        ['aws_docs_search', 'Search AWS docs'],
      ],
      [
        ['aws_invoke_safe_api', 'Call allowlisted AWS APIs'],
      ],
    ),
  },
  {
    serviceId: 'linear',
    serverId: 'linear',
    availability: 'official_remote',
    authMode: 'api_token',
    connectable: true,
    permissionLevels: ['read', 'write'],
    docsUrl: 'https://linear.app/docs/mcp',
    notes:
      'Linear remote MCP (https://mcp.linear.app/mcp) — API key in Connections; OAuth scaffolding via MCP_LINEAR_CLIENT_ID when preferred.',
    tools: tools(
      [
        ['linear_get_issue', 'Read issue'],
        ['linear_search', 'Search issues'],
      ],
      [
        ['linear_create_comment', 'Comment'],
        ['linear_update_issue', 'Update issue'],
      ],
    ),
  },
  {
    serviceId: 'gitlab',
    serverId: 'gitlab',
    availability: 'official_remote',
    authMode: 'oauth',
    connectable: true,
    permissionLevels: LEVELS,
    docsUrl: 'https://docs.gitlab.com/user/model_context_protocol/mcp_server/',
    notes: 'GitLab.com remote MCP (https://gitlab.com/api/v4/mcp) — OAuth via MCP_GITLAB_CLIENT_* or PAT fallback.',
    tools: tools(
      [
        ['gitlab_get_file', 'Read file'],
        ['gitlab_list_mrs', 'List merge requests'],
        ['gitlab_get_issue', 'Read issue'],
      ],
      [
        ['gitlab_create_mr', 'Create merge request'],
        ['gitlab_comment', 'Comment'],
      ],
    ),
  },
  {
    serviceId: 'gitlab_self_managed',
    serverId: 'gitlab_self_managed',
    availability: 'community',
    authMode: 'pat',
    connectable: true,
    permissionLevels: LEVELS,
    notes: 'Self-managed base URL + group token over private link.',
    tools: tools(
      [
        ['glsm_get_file', 'Read file'],
        ['glsm_list_mrs', 'List MRs'],
      ],
      [['glsm_create_mr', 'Create MR']],
    ),
  },
  {
    serviceId: 'slack',
    serverId: 'slack',
    availability: 'community',
    authMode: 'oauth',
    connectable: true,
    permissionLevels: ['read', 'write'],
    notes:
      'Channel allowlist required. Authorize via Slack OAuth (MCP_SLACK_CLIENT_*) once a community/vendor MCP URL is set (MCP_SLACK_URL).',
    tools: tools(
      [
        ['slack_list_channels', 'List allowed channels'],
        ['slack_read_history', 'Read recent messages'],
        ['slack_search', 'Search messages'],
      ],
      [
        ['slack_post_message', 'Post a message'],
        ['slack_add_reaction', 'Add reaction'],
      ],
    ),
  },
  {
    serviceId: 'teams',
    serverId: 'teams',
    availability: 'community',
    authMode: 'oauth',
    connectable: true,
    permissionLevels: ['read', 'write'],
    notes: 'Microsoft Graph consent + tenant admin approval.',
    tools: tools(
      [
        ['teams_list_chats', 'List chats/channels'],
        ['teams_read_messages', 'Read messages'],
      ],
      [['teams_send_message', 'Send a message']],
    ),
  },
  {
    serviceId: 'azure_devops',
    serverId: 'azure_devops',
    availability: 'bridge',
    authMode: 'pat',
    connectable: true,
    permissionLevels: ['read', 'write'],
    docsUrl: 'https://github.com/microsoft/azure-devops-mcp',
    notes:
      'Host microsoft/azure-devops-mcp as a private bridge (stdio/HTTP); set MCP_AZURE_DEVOPS_URL + PAT. Not a public SaaS MCP URL.',
    tools: tools(
      [
        ['ado_get_work_item', 'Read work item'],
        ['ado_search', 'Search work items'],
      ],
      [
        ['ado_update_work_item', 'Update work item'],
        ['ado_add_comment', 'Add comment'],
      ],
    ),
  },
  {
    serviceId: 'azure',
    serverId: 'azure',
    availability: 'community',
    authMode: 'iam_role',
    connectable: true,
    permissionLevels: ['read', 'write'],
    tools: tools(
      [
        ['azure_list_resources', 'List resources'],
        ['azure_read_metrics', 'Read metrics'],
      ],
      [['azure_invoke_arm', 'Call allowlisted ARM APIs']],
    ),
  },
  {
    serviceId: 'gcp',
    serverId: 'gcp',
    availability: 'community',
    authMode: 'iam_role',
    connectable: true,
    permissionLevels: ['read', 'write'],
    tools: tools(
      [
        ['gcp_list_resources', 'List projects/resources'],
        ['gcp_read_logs', 'Read Cloud Logging'],
      ],
      [['gcp_invoke_api', 'Call allowlisted GCP APIs']],
    ),
  },
  {
    serviceId: 'azure_repos',
    serverId: 'azure_repos',
    availability: 'bridge',
    authMode: 'pat',
    connectable: true,
    permissionLevels: ['read', 'write'],
    docsUrl: 'https://github.com/microsoft/azure-devops-mcp',
    notes: 'Same Azure DevOps MCP bridge as Boards — PAT + MCP_AZURE_DEVOPS_URL.',
    tools: tools(
      [
        ['azrepos_read_file', 'Read file'],
        ['azrepos_list_prs', 'List PRs'],
      ],
      [['azrepos_create_pr', 'Create PR']],
    ),
  },
  {
    serviceId: 'google_drive',
    serverId: 'google_drive',
    availability: 'community',
    authMode: 'oauth',
    connectable: true,
    permissionLevels: ['read', 'write'],
    tools: tools(
      [
        ['gdrive_search', 'Search files'],
        ['gdrive_read', 'Read file metadata/content'],
      ],
      [['gdrive_comment', 'Comment on a file']],
    ),
  },
  {
    serviceId: 'outlook',
    serverId: 'outlook',
    availability: 'community',
    authMode: 'oauth',
    connectable: true,
    permissionLevels: ['read', 'write'],
    tools: tools(
      [
        ['outlook_search_mail', 'Search mail'],
        ['outlook_read_message', 'Read a message'],
      ],
      [['outlook_draft_reply', 'Create a draft reply']],
    ),
  },
  {
    serviceId: 'gmail',
    serverId: 'gmail',
    availability: 'community',
    authMode: 'oauth',
    connectable: true,
    permissionLevels: ['read', 'write'],
    tools: tools(
      [
        ['gmail_search', 'Search mail'],
        ['gmail_read', 'Read a message'],
      ],
      [['gmail_draft', 'Create a draft']],
    ),
  },
  {
    serviceId: 'cursor',
    serverId: 'cursor',
    availability: 'bridge',
    authMode: 'pat',
    connectable: true,
    permissionLevels: ['read', 'write'],
    notes:
      'Cursor is primarily an MCP client — AplifyAI will not fake Connected. Set MCP_CURSOR_BRIDGE_URL only for a real agent-kit bridge.',
    tools: tools(
      [
        ['cursor_list_kits', 'List allowed agent kits'],
        ['cursor_read_context', 'Read sandbox context'],
      ],
      [['cursor_run_kit', 'Run an allowlisted kit']],
    ),
  },

  // —— Board aliases that reuse code MCP ——
  {
    serviceId: 'github_projects',
    serverId: 'github_projects',
    availability: 'official_remote',
    authMode: 'pat',
    connectable: true,
    permissionLevels: ['read', 'write'],
    notes: 'Uses GitHub MCP project/issue tools under a projects-focused allowlist (same PAT as GitHub).',
    tools: tools(
      [
        ['gh_projects_list', 'List projects'],
        ['gh_projects_get_item', 'Read project item'],
      ],
      [['gh_projects_update_item', 'Update project item']],
    ),
  },
  {
    serviceId: 'gitlab_boards',
    serverId: 'gitlab_boards',
    availability: 'community',
    authMode: 'oauth',
    connectable: true,
    permissionLevels: ['read', 'write'],
    notes: 'GitLab issue-board tools via GitLab MCP.',
    tools: tools(
      [
        ['gl_boards_list', 'List boards'],
        ['gl_boards_list_issues', 'List board issues'],
      ],
      [['gl_boards_move_issue', 'Move issue on board']],
    ),
  },

  // —— Observability / logging ——
  {
    serviceId: 'datadog',
    serverId: 'datadog',
    availability: 'community',
    authMode: 'api_token',
    connectable: true,
    permissionLevels: ['read', 'write'],
    docsUrl: 'https://docs.datadoghq.com/',
    notes: 'Datadog logs/metrics MCP bridge — set MCP_DATADOG_URL or MCP_DATADOG_API_KEY.',
    tools: tools(
      [
        ['datadog_search_logs', 'Search recent logs'],
        ['datadog_query_metrics', 'Query metrics'],
        ['datadog_list_monitors', 'List monitors'],
      ],
      [['datadog_create_event', 'Create a Datadog event']],
    ),
  },
  {
    serviceId: 'aws_cloudwatch',
    serverId: 'aws_cloudwatch',
    availability: 'community',
    authMode: 'iam_role',
    connectable: true,
    permissionLevels: ['read', 'write'],
    docsUrl: 'https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/WhatIsCloudWatchLogs.html',
    notes: 'CloudWatch Logs via AWS MCP / role — MCP_CLOUDWATCH_URL or AWS_ROLE_ARN.',
    tools: tools(
      [
        ['cw_list_log_groups', 'List log groups'],
        ['cw_filter_log_events', 'Filter log events'],
        ['cw_get_metric_stats', 'Get metric statistics'],
      ],
      [['cw_put_metric_alarm', 'Create/update a metric alarm']],
    ),
  },
  {
    serviceId: 'splunk',
    serverId: 'splunk',
    availability: 'community',
    authMode: 'api_token',
    connectable: true,
    permissionLevels: ['read', 'write'],
    notes: 'Splunk Enterprise / Cloud search MCP — MCP_SPLUNK_URL or MCP_SPLUNK_TOKEN.',
    tools: tools(
      [
        ['splunk_search', 'Run a SPL search'],
        ['splunk_list_indexes', 'List indexes'],
      ],
      [['splunk_create_alert', 'Create a saved search alert']],
    ),
  },
  {
    serviceId: 'elasticsearch',
    serverId: 'elasticsearch',
    availability: 'community',
    authMode: 'api_token',
    connectable: true,
    permissionLevels: ['read', 'write'],
    notes: 'Elasticsearch / OpenSearch log search MCP — MCP_ELASTICSEARCH_URL or MCP_OPENSEARCH_URL.',
    tools: tools(
      [
        ['es_search', 'Search an index'],
        ['es_list_indices', 'List indices'],
        ['es_get_mapping', 'Read index mapping'],
      ],
      [['es_index_doc', 'Index a document (allowlisted)']],
    ),
  },
  {
    serviceId: 'new_relic',
    serverId: 'new_relic',
    availability: 'community',
    authMode: 'api_token',
    connectable: true,
    permissionLevels: ['read', 'write'],
    notes: 'New Relic NRQL / logs MCP — MCP_NEW_RELIC_URL or MCP_NEW_RELIC_API_KEY.',
    tools: tools(
      [
        ['nr_nrql_query', 'Run an NRQL query'],
        ['nr_search_logs', 'Search logs'],
        ['nr_list_entities', 'List entities'],
      ],
      [['nr_create_alert', 'Create an alert condition']],
    ),
  },
  {
    serviceId: 'grafana_loki',
    serverId: 'grafana_loki',
    availability: 'community',
    authMode: 'api_token',
    connectable: true,
    permissionLevels: ['read', 'write'],
    notes: 'Grafana Loki LogQL MCP — MCP_GRAFANA_LOKI_URL / MCP_LOKI_URL or token.',
    tools: tools(
      [
        ['loki_query_range', 'Run a LogQL range query'],
        ['loki_label_values', 'List label values'],
      ],
      [['loki_push_labels', 'Push allowlisted label metadata']],
    ),
  },
];

const BY_SERVICE = new Map(MCP_PROVIDERS.map((p) => [p.serviceId, p]));

export function getMcpProvider(serviceId: ServiceId): McpProviderDef | undefined {
  return BY_SERVICE.get(serviceId);
}

export function hasMcpOption(serviceId: ServiceId): boolean {
  const p = BY_SERVICE.get(serviceId);
  return Boolean(p && p.availability !== 'none');
}

export function toolsForPermissionLevel(
  provider: McpProviderDef,
  level: McpPermissionLevel,
): McpToolDef[] {
  const rank: Record<McpPermissionLevel, number> = { read: 0, write: 1, admin: 2 };
  const max = rank[level];
  return provider.tools.filter((t) => rank[t.minLevel] <= max);
}

export function mcpAvailabilityLabel(availability: McpAvailability): string {
  switch (availability) {
    case 'official_remote':
      return 'Official MCP (remote)';
    case 'official_local':
      return 'Official MCP (self-hosted)';
    case 'community':
      return 'Community MCP';
    case 'bridge':
      return 'MCP bridge';
    case 'none':
      return 'No MCP yet';
  }
}
