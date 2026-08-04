/**
 * Official / remote MCP transport configuration.
 *
 * When an endpoint (or OAuth client) is configured via env, callTool records
 * `transport: 'remote'` and would hand off to that URL. Default official MCP
 * URLs are set for remote token providers so a tenant bearer alone unlocks
 * live calls (same pattern as GitHub). Credentials never enter prompts.
 */

import { MCP_PROVIDERS } from '../../../shared/mcpProviders';
import type { ServiceId } from '../../../shared/types';

export type McpTransportKind = 'stub' | 'remote_http' | 'stdio';

export type McpTransportConfig = {
  serviceId: ServiceId;
  kind: McpTransportKind;
  /** Remote MCP base URL when kind === remote_http */
  endpoint?: string;
  /** Optional OAuth client id for the provider (secret stays in env). */
  clientIdConfigured: boolean;
  ready: boolean;
  note: string;
};

function env(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v || undefined;
}

function remote(
  serviceId: ServiceId,
  opts: {
    endpoint?: string;
    ready: boolean;
    clientIdConfigured?: boolean;
    note: string;
  },
): McpTransportConfig {
  return {
    serviceId,
    kind: opts.endpoint || opts.ready ? 'remote_http' : 'stub',
    endpoint: opts.endpoint,
    clientIdConfigured: Boolean(opts.clientIdConfigured),
    ready: opts.ready,
    note: opts.note,
  };
}

/** Map service → transport readiness from env (+ default official endpoints). */
export function resolveTransport(serviceId: ServiceId): McpTransportConfig {
  switch (serviceId) {
    case 'jira':
    case 'confluence':
    case 'bitbucket': {
      const endpoint = env('MCP_ATLASSIAN_URL') ?? 'https://mcp.atlassian.com/v1/sse';
      const clientIdConfigured = Boolean(env('MCP_ATLASSIAN_CLIENT_ID'));
      const tokenConfigured = Boolean(env('MCP_ATLASSIAN_ACCESS_TOKEN'));
      const ready = Boolean(
        env('MCP_ATLASSIAN_URL') || env('MCP_ATLASSIAN_CLIENT_ID') || env('MCP_ATLASSIAN_ACCESS_TOKEN'),
      );
      return remote(serviceId, {
        endpoint,
        ready,
        clientIdConfigured,
        note: tokenConfigured
          ? 'Atlassian access token set — remote MCP tools use Bearer auth.'
          : clientIdConfigured
            ? 'Atlassian OAuth client configured — complete authorize to obtain a token.'
            : 'Demo stub. Set MCP_ATLASSIAN_ACCESS_TOKEN or MCP_ATLASSIAN_CLIENT_ID for live MCP (tenant OAuth preferred).',
      });
    }
    case 'github_projects':
    case 'github':
    case 'github_enterprise': {
      const endpoint = env('MCP_GITHUB_URL') ?? 'https://api.githubcopilot.com/mcp/';
      const ready = Boolean(env('MCP_GITHUB_TOKEN') || env('MCP_GITHUB_URL'));
      return remote(serviceId, {
        endpoint,
        ready,
        clientIdConfigured: Boolean(env('MCP_GITHUB_TOKEN')),
        note: ready
          ? 'GitHub MCP token/URL configured.'
          : 'Default GitHub MCP endpoint — set a per-tenant PAT in Connections (or MCP_GITHUB_TOKEN).',
      });
    }
    case 'notion': {
      const endpoint = env('MCP_NOTION_URL') ?? 'https://mcp.notion.com/mcp';
      const ready = Boolean(env('MCP_NOTION_TOKEN') || env('MCP_NOTION_URL'));
      return remote(serviceId, {
        endpoint,
        ready,
        clientIdConfigured: Boolean(env('MCP_NOTION_TOKEN')),
        note: ready
          ? 'Notion remote MCP configured.'
          : 'Default Notion MCP endpoint — paste an integration token in Connections (or MCP_NOTION_TOKEN).',
      });
    }
    case 'linear': {
      const endpoint = env('MCP_LINEAR_URL') ?? 'https://mcp.linear.app/mcp';
      const ready = Boolean(
        env('MCP_LINEAR_TOKEN') ||
          env('MCP_LINEAR_API_KEY') ||
          env('MCP_LINEAR_URL') ||
          env('MCP_LINEAR_CLIENT_ID') ||
          env('MCP_LINEAR_ACCESS_TOKEN'),
      );
      return remote(serviceId, {
        endpoint,
        ready,
        clientIdConfigured: Boolean(env('MCP_LINEAR_CLIENT_ID') || env('MCP_LINEAR_TOKEN')),
        note: ready
          ? 'Linear MCP configured.'
          : 'Default Linear MCP endpoint — API key in Connections, or OAuth via MCP_LINEAR_CLIENT_ID.',
      });
    }
    case 'gitlab':
    case 'gitlab_boards': {
      const endpoint = env('MCP_GITLAB_URL') ?? 'https://gitlab.com/api/v4/mcp';
      const ready = Boolean(
        env('MCP_GITLAB_TOKEN') ||
          env('MCP_GITLAB_URL') ||
          env('MCP_GITLAB_CLIENT_ID') ||
          env('MCP_GITLAB_ACCESS_TOKEN'),
      );
      return remote(serviceId, {
        endpoint,
        ready,
        clientIdConfigured: Boolean(env('MCP_GITLAB_CLIENT_ID') || env('MCP_GITLAB_TOKEN')),
        note: ready
          ? 'GitLab.com MCP configured.'
          : 'Default GitLab.com MCP endpoint — OAuth (MCP_GITLAB_CLIENT_ID) or token in Connections.',
      });
    }
    case 'gitlab_self_managed': {
      const endpoint = env('MCP_GITLAB_SM_URL') ?? env('MCP_GITLAB_URL');
      const ready = Boolean(endpoint || env('MCP_GITLAB_SM_TOKEN') || env('MCP_GITLAB_TOKEN'));
      return remote(serviceId, {
        endpoint,
        ready,
        clientIdConfigured: Boolean(env('MCP_GITLAB_SM_TOKEN') || env('MCP_GITLAB_TOKEN')),
        note: ready
          ? 'GitLab self-managed MCP configured.'
          : 'Set MCP_GITLAB_SM_URL (instance /api/v4/mcp) and a group/personal token in Connections.',
      });
    }
    case 'aws': {
      const endpoint = env('MCP_AWS_URL') ?? 'https://aws-mcp.us-east-1.api.aws/mcp';
      const ready = Boolean(env('MCP_AWS_URL') || env('AWS_ROLE_ARN'));
      return remote(serviceId, {
        endpoint,
        ready,
        clientIdConfigured: Boolean(env('AWS_ROLE_ARN')),
        note: ready
          ? 'AWS MCP endpoint / role configured.'
          : 'Default AWS MCP endpoint — link a role ARN in Connections (or AWS_ROLE_ARN).',
      });
    }
    case 'aws_cloudwatch': {
      const endpoint =
        env('MCP_CLOUDWATCH_URL') ?? env('MCP_AWS_URL') ?? 'https://aws-mcp.us-east-1.api.aws/mcp';
      const ready = Boolean(
        env('MCP_CLOUDWATCH_URL') ||
          env('MCP_AWS_URL') ||
          env('AWS_ROLE_ARN') ||
          env('MCP_CLOUDWATCH_TOKEN'),
      );
      return remote(serviceId, {
        endpoint,
        ready,
        clientIdConfigured: Boolean(env('AWS_ROLE_ARN') || env('MCP_CLOUDWATCH_TOKEN')),
        note: ready
          ? 'CloudWatch MCP transport configured.'
          : 'Default AWS MCP endpoint for CloudWatch — link AWS_ROLE_ARN / role in Connections.',
      });
    }
    case 'gcp': {
      const endpoint = env('MCP_GCP_URL');
      const ready = Boolean(endpoint || env('GCP_PROJECT_ID') || env('MCP_GCP_CLIENT_ID'));
      return remote(serviceId, {
        endpoint,
        ready,
        clientIdConfigured: Boolean(env('GCP_PROJECT_ID') || env('MCP_GCP_CLIENT_ID')),
        note: ready
          ? 'GCP MCP transport configured.'
          : 'Set MCP_GCP_URL and link a GCP project id in Connections (workload identity / SA).',
      });
    }
    case 'azure': {
      const endpoint = env('MCP_AZURE_URL');
      const ready = Boolean(
        endpoint ||
          env('AZURE_SUBSCRIPTION_ID') ||
          env('AZURE_TENANT_ID') ||
          env('MCP_AZURE_CLIENT_ID'),
      );
      return remote(serviceId, {
        endpoint,
        ready,
        clientIdConfigured: Boolean(env('AZURE_SUBSCRIPTION_ID') || env('MCP_AZURE_CLIENT_ID')),
        note: ready
          ? 'Azure MCP transport configured.'
          : 'Set MCP_AZURE_URL and link subscription / SP identifiers in Connections.',
      });
    }
    case 'azure_devops':
    case 'azure_repos': {
      const endpoint = env('MCP_AZURE_DEVOPS_URL');
      const ready = Boolean(
        endpoint || env('MCP_AZURE_DEVOPS_TOKEN') || env('AZURE_DEVOPS_PAT'),
      );
      return remote(serviceId, {
        endpoint,
        ready,
        clientIdConfigured: Boolean(env('MCP_AZURE_DEVOPS_TOKEN') || env('AZURE_DEVOPS_PAT')),
        note: ready
          ? 'Azure DevOps MCP bridge configured.'
          : 'Host microsoft/azure-devops-mcp as a private bridge; set MCP_AZURE_DEVOPS_URL + PAT in Connections.',
      });
    }
    case 'slack': {
      const endpoint = env('MCP_SLACK_URL');
      const ready = Boolean(
        endpoint ||
          env('MCP_SLACK_TOKEN') ||
          env('MCP_SLACK_CLIENT_ID') ||
          env('MCP_SLACK_ACCESS_TOKEN'),
      );
      return remote(serviceId, {
        endpoint,
        ready,
        clientIdConfigured: Boolean(env('MCP_SLACK_CLIENT_ID') || env('MCP_SLACK_TOKEN')),
        note: ready
          ? 'Slack MCP transport configured.'
          : 'Set MCP_SLACK_URL (community/vendor MCP) and authorize via OAuth (MCP_SLACK_CLIENT_ID) or token.',
      });
    }
    case 'teams':
    case 'outlook': {
      const endpoint = env('MCP_MICROSOFT_URL') ?? env('MCP_TEAMS_URL') ?? env('MCP_OUTLOOK_URL');
      const ready = Boolean(
        endpoint || env('MCP_MICROSOFT_CLIENT_ID') || env('MCP_MICROSOFT_ACCESS_TOKEN'),
      );
      return remote(serviceId, {
        endpoint,
        ready,
        clientIdConfigured: Boolean(env('MCP_MICROSOFT_CLIENT_ID')),
        note: ready
          ? 'Microsoft Graph MCP transport configured.'
          : 'Set MCP_MICROSOFT_URL and OAuth (MCP_MICROSOFT_CLIENT_ID) for Teams / Outlook.',
      });
    }
    case 'gmail':
    case 'google_drive': {
      const endpoint = env('MCP_GOOGLE_URL') ?? env('MCP_GMAIL_URL') ?? env('MCP_GDRIVE_URL');
      const ready = Boolean(
        endpoint || env('MCP_GOOGLE_MCP_CLIENT_ID') || env('MCP_GOOGLE_MCP_ACCESS_TOKEN'),
      );
      return remote(serviceId, {
        endpoint,
        ready,
        clientIdConfigured: Boolean(env('MCP_GOOGLE_MCP_CLIENT_ID')),
        note: ready
          ? 'Google MCP transport configured.'
          : 'Set MCP_GOOGLE_URL and OAuth (MCP_GOOGLE_MCP_CLIENT_ID) for Gmail / Drive.',
      });
    }
    case 'datadog': {
      const endpoint = env('MCP_DATADOG_URL');
      const ready = Boolean(endpoint || env('MCP_DATADOG_API_KEY'));
      return remote(serviceId, {
        endpoint,
        ready,
        clientIdConfigured: Boolean(env('MCP_DATADOG_API_KEY')),
        note: ready
          ? 'Datadog MCP transport configured.'
          : 'Set MCP_DATADOG_URL and paste an API key in Connections (or MCP_DATADOG_API_KEY).',
      });
    }
    case 'splunk': {
      const endpoint = env('MCP_SPLUNK_URL');
      const ready = Boolean(endpoint || env('MCP_SPLUNK_TOKEN'));
      return remote(serviceId, {
        endpoint,
        ready,
        clientIdConfigured: Boolean(env('MCP_SPLUNK_TOKEN')),
        note: ready
          ? 'Splunk MCP transport configured.'
          : 'Set MCP_SPLUNK_URL and paste a token in Connections (or MCP_SPLUNK_TOKEN).',
      });
    }
    case 'elasticsearch': {
      const endpoint = env('MCP_ELASTICSEARCH_URL') ?? env('MCP_OPENSEARCH_URL');
      const ready = Boolean(endpoint || env('MCP_ELASTICSEARCH_TOKEN') || env('MCP_OPENSEARCH_TOKEN'));
      return remote(serviceId, {
        endpoint,
        ready,
        clientIdConfigured: Boolean(env('MCP_ELASTICSEARCH_TOKEN') || env('MCP_OPENSEARCH_TOKEN')),
        note: ready
          ? 'Elasticsearch / OpenSearch MCP transport configured.'
          : 'Set MCP_ELASTICSEARCH_URL / MCP_OPENSEARCH_URL and a token in Connections.',
      });
    }
    case 'new_relic': {
      const endpoint = env('MCP_NEW_RELIC_URL');
      const ready = Boolean(endpoint || env('MCP_NEW_RELIC_API_KEY'));
      return remote(serviceId, {
        endpoint,
        ready,
        clientIdConfigured: Boolean(env('MCP_NEW_RELIC_API_KEY')),
        note: ready
          ? 'New Relic MCP transport configured.'
          : 'Set MCP_NEW_RELIC_URL and paste an API key in Connections (or MCP_NEW_RELIC_API_KEY).',
      });
    }
    case 'grafana_loki': {
      const endpoint = env('MCP_GRAFANA_LOKI_URL') ?? env('MCP_LOKI_URL');
      const ready = Boolean(endpoint || env('MCP_GRAFANA_TOKEN') || env('MCP_LOKI_TOKEN'));
      return remote(serviceId, {
        endpoint,
        ready,
        clientIdConfigured: Boolean(env('MCP_GRAFANA_TOKEN') || env('MCP_LOKI_TOKEN')),
        note: ready
          ? 'Grafana Loki MCP transport configured.'
          : 'Set MCP_GRAFANA_LOKI_URL / MCP_LOKI_URL and a token in Connections.',
      });
    }
    case 'cursor': {
      const endpoint = env('MCP_CURSOR_BRIDGE_URL') ?? env('MCP_CURSOR_URL');
      const ready = Boolean(endpoint);
      return remote(serviceId, {
        endpoint,
        ready,
        clientIdConfigured: false,
        note: ready
          ? 'Cursor agent-kit bridge endpoint configured.'
          : 'Cursor is primarily an MCP client — Connect stays blocked until MCP_CURSOR_BRIDGE_URL is set to a real bridge (not a fake Connected badge).',
      });
    }
    default:
      return {
        serviceId,
        kind: 'stub',
        clientIdConfigured: false,
        ready: false,
        note: 'Community / bridge provider — demo stub until a transport is configured.',
      };
  }
}

export function listConfiguredTransports(): McpTransportConfig[] {
  // Every connectable registry entry — UI badges and Connect gating use this list.
  const ids = [
    ...new Set(MCP_PROVIDERS.filter((p) => p.connectable).map((p) => p.serviceId)),
  ];
  return ids.map(resolveTransport);
}
