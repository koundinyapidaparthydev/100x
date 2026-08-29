import { afterEach, describe, expect, it, vi } from 'vitest';
import { callRemoteMcpTool } from './remoteClient';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('callRemoteMcpTool', () => {
  it('posts JSON-RPC tools/call and returns result', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: { content: 'ok' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    const out = await callRemoteMcpTool({
      endpoint: 'https://example.test/mcp',
      tool: 'jira_get_issue',
      args: { key: 'X100-1' },
      bearerToken: 'token',
    });

    expect(out.ok).toBe(true);
    expect(out.data).toEqual({ content: 'ok' });
    expect(fetch).toHaveBeenCalledWith(
      'https://example.test/mcp',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer token' }),
      }),
    );
  });

  it('returns error on HTTP failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('unauthorized', { status: 401 })),
    );

    const out = await callRemoteMcpTool({
      endpoint: 'https://example.test/mcp',
      tool: 'jira_get_issue',
    });

    expect(out.ok).toBe(false);
    expect(out.status).toBe(401);
    expect(out.error).toMatch(/401/);
  });
});
