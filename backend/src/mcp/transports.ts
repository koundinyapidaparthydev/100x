/**
 * Official / remote MCP transport configuration.
 *
 * When an endpoint (or OAuth client) is configured via env, callTool records
 * `transport: 'remote'` and would hand off to that URL. Without env, demo
 * stub mode stays on. Credentials never enter prompts — only connection
 * metadata + allowlisted tool names are used at runtime.
 */

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

/** Map service → transport readiness from env. */
export function resolveTransport(serviceId: ServiceId): McpTransportConfig {
  switch (serviceId) {
    case 'jira':
    case 'confluence':
    case 'bitbucket':
    case 'gitlab_boards': {
      const endpoint = env('MCP_ATLASSIAN_URL') ?? 'https://mcp.atlassian.com/v1/sse';
      const clientIdConfigured = Boolean(env('MCP_ATLASSIAN_CLIENT_ID'));
      const tokenConfigured = Boolean(env('MCP_ATLASSIAN_ACCESS_TOKEN'));
      const ready = Boolean(
        env('MCP_ATLASSIAN_URL') || env('MCP_ATLASSIAN_CLIENT_ID') || env('MCP_ATLASSIAN_ACCESS_TOKEN'),
      );
      return {
        serviceId,
        kind: ready ? 'remote_http' : 'stub',
        endpoint,
        clientIdConfigured,
        ready,
        note: tokenConfigured
          ? 'Atlassian access token set — remote MCP tools use Bearer auth.'
          : clientIdConfigured
            ? 'Atlassian OAuth client configured — complete authorize to obtain a token.'
            : 'Demo stub. Set MCP_ATLASSIAN_ACCESS_TOKEN or MCP_ATLASSIAN_CLIENT_ID for live MCP.',
      };
    }
    case 'github_projects': {
      const endpoint = env('MCP_GITHUB_URL') ?? 'https://api.githubcopilot.com/mcp/';
      const ready = Boolean(env('MCP_GITHUB_TOKEN') || env('MCP_GITHUB_URL'));
      return {
        serviceId,
        kind: ready ? 'remote_http' : 'stub',
        endpoint,
        clientIdConfigured: Boolean(env('MCP_GITHUB_TOKEN')),
        ready,
        note: ready
          ? 'GitHub MCP token/URL configured (projects tools).'
          : 'Demo stub. Set MCP_GITHUB_TOKEN or MCP_GITHUB_URL for live GitHub MCP.',
      };
    }
    case 'github':
    case 'github_enterprise': {
      const endpoint = env('MCP_GITHUB_URL') ?? 'https://api.githubcopilot.com/mcp/';
      const ready = Boolean(env('MCP_GITHUB_TOKEN') || env('MCP_GITHUB_URL'));
      return {
        serviceId,
        kind: ready ? 'remote_http' : 'stub',
        endpoint,
        clientIdConfigured: Boolean(env('MCP_GITHUB_TOKEN')),
        ready,
        note: ready
          ? 'GitHub MCP token/URL configured.'
          : 'Demo stub. Set MCP_GITHUB_TOKEN or MCP_GITHUB_URL for live GitHub MCP.',
      };
    }
    case 'notion': {
      const endpoint = env('MCP_NOTION_URL') ?? 'https://mcp.notion.com/mcp';
      const ready = Boolean(env('MCP_NOTION_TOKEN') || env('MCP_NOTION_URL'));
      return {
        serviceId,
        kind: ready ? 'remote_http' : 'stub',
        endpoint,
        clientIdConfigured: Boolean(env('MCP_NOTION_TOKEN')),
        ready,
        note: ready
          ? 'Notion remote MCP configured.'
          : 'Demo stub. Set MCP_NOTION_TOKEN or MCP_NOTION_URL for live Notion MCP.',
      };
    }
    case 'aws': {
      const endpoint = env('MCP_AWS_URL') ?? 'https://aws-mcp.us-east-1.api.aws/mcp';
      const ready = Boolean(env('MCP_AWS_URL') || env('AWS_ROLE_ARN'));
      return {
        serviceId,
        kind: ready ? 'remote_http' : 'stub',
        endpoint,
        clientIdConfigured: Boolean(env('AWS_ROLE_ARN')),
        ready,
        note: ready
          ? 'AWS MCP endpoint / role configured.'
          : 'Demo stub. Set MCP_AWS_URL or AWS_ROLE_ARN for live AWS MCP.',
      };
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
  const ids: ServiceId[] = [
    'jira',
    'confluence',
    'bitbucket',
    'github',
    'github_enterprise',
    'notion',
    'aws',
  ];
  return ids.map(resolveTransport);
}
