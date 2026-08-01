import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildAtlassianAuthorizeUrl,
  clearAtlassianRuntimeToken,
  completeAtlassianOAuthCallback,
  getAtlassianAccessToken,
  getAtlassianMcpOAuthStatus,
} from './atlassianOAuth';

afterEach(() => {
  delete process.env.MCP_ATLASSIAN_CLIENT_ID;
  delete process.env.MCP_ATLASSIAN_CLIENT_SECRET;
  delete process.env.MCP_ATLASSIAN_REDIRECT_URI;
  delete process.env.MCP_ATLASSIAN_ACCESS_TOKEN;
  delete process.env.MCP_ATLASSIAN_TOKEN_URL;
  clearAtlassianRuntimeToken();
  vi.unstubAllGlobals();
});

describe('Atlassian MCP OAuth', () => {
  it('reports disabled when unset', () => {
    const status = getAtlassianMcpOAuthStatus();
    expect(status.enabled).toBe(false);
    expect(status.authorizeReady).toBe(false);
  });

  it('builds a PKCE authorize URL when client + redirect are set', () => {
    process.env.MCP_ATLASSIAN_CLIENT_ID = 'client';
    process.env.MCP_ATLASSIAN_REDIRECT_URI = 'http://localhost:4000/callback';
    const started = buildAtlassianAuthorizeUrl();
    expect(started).not.toBeNull();
    expect(started!.url).toContain('auth.atlassian.com');
    expect(started!.url).toContain('code_challenge');
    expect(started!.url).toContain('client_id=client');
    expect(getAtlassianMcpOAuthStatus().authorizeReady).toBe(true);
  });

  it('exchanges code for token and stores it in-process', async () => {
    process.env.MCP_ATLASSIAN_CLIENT_ID = 'client';
    process.env.MCP_ATLASSIAN_REDIRECT_URI = 'http://localhost:4000/callback';
    process.env.MCP_ATLASSIAN_TOKEN_URL = 'https://example.test/oauth/token';
    const started = buildAtlassianAuthorizeUrl();
    expect(started).not.toBeNull();

    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({ access_token: 'atl-token', expires_in: 3600, scope: 'read:jira-work' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );

    const result = await completeAtlassianOAuthCallback({
      code: 'auth-code',
      state: started!.state,
    });
    expect(result.accessToken).toBe('atl-token');
    expect(getAtlassianAccessToken()).toBe('atl-token');
    expect(getAtlassianMcpOAuthStatus().hasAccessToken).toBe(true);
  });
});
