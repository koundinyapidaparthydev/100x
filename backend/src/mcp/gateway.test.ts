import { describe, expect, it } from 'vitest';
import { callTool, createConnection, listGrantedTools } from './gateway';

describe('McpGateway', () => {
  it('connects Jira at read and grants only read tools', () => {
    const conn = createConnection('jira', 'read');
    expect(conn.status).toBe('connected');
    expect(conn.grantedTools.length).toBeGreaterThan(0);
    expect(conn.grantedTools.every((t) => !t.includes('admin'))).toBe(true);
    expect(listGrantedTools(conn)).toContain('jira_get_issue');
  });

  it('denies tools outside the granted permission band', () => {
    const conn = createConnection('jira', 'read');
    const denied = callTool(conn, 'jira_add_comment');
    expect(denied.ok).toBe(false);
    const allowed = callTool(conn, 'jira_get_issue');
    expect(allowed.ok).toBe(true);
  });

  it('rejects services without an MCP provider', () => {
    const conn = createConnection('smartsheet', 'read');
    expect(conn.status).toBe('error');
  });

  it('connects official and community MCP providers used in onboarding', () => {
    for (const id of [
      'jira',
      'confluence',
      'notion',
      'github',
      'slack',
      'aws',
      'gitlab',
      'linear',
      'teams',
    ] as const) {
      const conn = createConnection(id, 'read');
      expect(conn.status, id).toBe('connected');
      expect(conn.grantedTools.length, id).toBeGreaterThan(0);
    }
  });
});
