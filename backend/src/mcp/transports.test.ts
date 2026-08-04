import { afterEach, describe, expect, it } from 'vitest';
import { resolveTransport } from './transports';

const KEYS = [
  'MCP_ATLASSIAN_URL',
  'MCP_ATLASSIAN_CLIENT_ID',
  'MCP_GITHUB_TOKEN',
  'MCP_GITHUB_URL',
  'MCP_NOTION_TOKEN',
  'MCP_LINEAR_TOKEN',
  'MCP_AWS_URL',
  'AWS_ROLE_ARN',
  'MCP_DATADOG_URL',
  'MCP_CURSOR_BRIDGE_URL',
] as const;

afterEach(() => {
  for (const key of KEYS) delete process.env[key];
});

describe('MCP transports', () => {
  it('exposes default official endpoints even when env is unset', () => {
    expect(resolveTransport('jira').ready).toBe(false);
    expect(resolveTransport('jira').endpoint).toContain('atlassian');
    expect(resolveTransport('jira').kind).toBe('remote_http');

    expect(resolveTransport('github').ready).toBe(false);
    expect(resolveTransport('github').endpoint).toContain('githubcopilot');

    expect(resolveTransport('notion').ready).toBe(false);
    expect(resolveTransport('notion').endpoint).toBe('https://mcp.notion.com/mcp');

    expect(resolveTransport('linear').endpoint).toBe('https://mcp.linear.app/mcp');
    expect(resolveTransport('gitlab').endpoint).toBe('https://gitlab.com/api/v4/mcp');

    expect(resolveTransport('aws').ready).toBe(false);
    expect(resolveTransport('aws').endpoint).toContain('aws-mcp');

    expect(resolveTransport('cursor').ready).toBe(false);
    expect(resolveTransport('cursor').endpoint).toBeUndefined();
    expect(resolveTransport('cursor').kind).toBe('stub');
  });

  it('marks Atlassian ready when client id is set', () => {
    process.env.MCP_ATLASSIAN_CLIENT_ID = 'client-demo';
    const t = resolveTransport('jira');
    expect(t.ready).toBe(true);
    expect(t.kind).toBe('remote_http');
    expect(t.endpoint).toContain('atlassian');
  });

  it('marks GitHub ready when token is set', () => {
    process.env.MCP_GITHUB_TOKEN = 'ghp_demo';
    expect(resolveTransport('github').ready).toBe(true);
  });

  it('marks logging ready when URL is set', () => {
    process.env.MCP_DATADOG_URL = 'https://mcp.datadog.example/mcp';
    expect(resolveTransport('datadog').ready).toBe(true);
    expect(resolveTransport('datadog').endpoint).toContain('datadog');
  });
});
