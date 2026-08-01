import { afterEach, describe, expect, it } from 'vitest';
import { resolveTransport } from './transports';

const KEYS = [
  'MCP_ATLASSIAN_URL',
  'MCP_ATLASSIAN_CLIENT_ID',
  'MCP_GITHUB_TOKEN',
  'MCP_GITHUB_URL',
  'MCP_NOTION_TOKEN',
  'MCP_AWS_URL',
  'AWS_ROLE_ARN',
] as const;

afterEach(() => {
  for (const key of KEYS) delete process.env[key];
});

describe('MCP transports', () => {
  it('defaults official providers to stub when env is unset', () => {
    expect(resolveTransport('jira').kind).toBe('stub');
    expect(resolveTransport('jira').ready).toBe(false);
    expect(resolveTransport('github').ready).toBe(false);
    expect(resolveTransport('notion').ready).toBe(false);
    expect(resolveTransport('aws').ready).toBe(false);
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
});
