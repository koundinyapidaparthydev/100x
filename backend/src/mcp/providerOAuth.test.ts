import { describe, expect, it } from 'vitest';
import {
  buildProviderAuthorizeUrl,
  clearProviderOAuthPending,
  getProviderOAuthStatus,
  isProviderOAuthFamily,
} from './providerOAuth';

describe('provider OAuth scaffolding', () => {
  it('recognizes supported families', () => {
    expect(isProviderOAuthFamily('linear')).toBe(true);
    expect(isProviderOAuthFamily('gitlab')).toBe(true);
    expect(isProviderOAuthFamily('slack')).toBe(true);
    expect(isProviderOAuthFamily('microsoft')).toBe(true);
    expect(isProviderOAuthFamily('google')).toBe(true);
    expect(isProviderOAuthFamily('atlassian')).toBe(false);
  });

  it('reports authorizeReady false without env', () => {
    delete process.env.MCP_SLACK_CLIENT_ID;
    delete process.env.MCP_SLACK_REDIRECT_URI;
    const status = getProviderOAuthStatus('slack');
    expect(status.authorizeReady).toBe(false);
    expect(status.hasAccessToken).toBe(false);
  });

  it('builds authorize URL when client env is set', () => {
    process.env.MCP_LINEAR_CLIENT_ID = 'lin-client';
    process.env.MCP_LINEAR_REDIRECT_URI =
      'http://localhost:4000/api/v1/mcp/oauth/linear/callback';
    clearProviderOAuthPending();
    const started = buildProviderAuthorizeUrl('linear', 'tenant-1');
    expect(started).not.toBeNull();
    expect(started!.url).toContain('linear.app/oauth/authorize');
    expect(started!.url).toContain('code_challenge');
    delete process.env.MCP_LINEAR_CLIENT_ID;
    delete process.env.MCP_LINEAR_REDIRECT_URI;
  });
});
