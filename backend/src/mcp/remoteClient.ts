/**
 * Minimal remote MCP JSON-RPC client (HTTP POST + SSE body parsing).
 *
 * Used when MCP_* env marks a transport ready. On network/auth failure we
 * return a structured error so the gateway can fall back to the demo stub
 * without crashing the job pipeline.
 */

import { getAtlassianAccessToken } from './atlassianOAuth';
import { parseMcpResponseBody } from './sse';

export type RemoteMcpCallInput = {
  endpoint: string;
  tool: string;
  args?: Record<string, unknown>;
  /** Bearer token when the provider uses PAT / OAuth access token in env. */
  bearerToken?: string;
  timeoutMs?: number;
};

export type RemoteMcpCallOutput = {
  ok: boolean;
  status?: number;
  data?: unknown;
  error?: string;
  latencyMs: number;
};

let rpcId = 0;

export async function callRemoteMcpTool(input: RemoteMcpCallInput): Promise<RemoteMcpCallOutput> {
  const started = Date.now();
  const timeoutMs = input.timeoutMs ?? 8_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    };
    if (input.bearerToken) {
      headers.Authorization = `Bearer ${input.bearerToken}`;
    }

    rpcId += 1;
    const body = {
      jsonrpc: '2.0',
      id: rpcId,
      method: 'tools/call',
      params: {
        name: input.tool,
        arguments: input.args ?? {},
      },
    };

    const res = await fetch(input.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await res.text();
    const parsed = parseMcpResponseBody(text);

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: `Remote MCP HTTP ${res.status}: ${text.slice(0, 200)}`,
        latencyMs: Date.now() - started,
      };
    }

    const rpc = parsed as { result?: unknown; error?: { message?: string } };
    if (rpc && typeof rpc === 'object' && rpc.error) {
      return {
        ok: false,
        status: res.status,
        error: rpc.error.message ?? 'Remote MCP tool error',
        latencyMs: Date.now() - started,
        data: parsed,
      };
    }

    return {
      ok: true,
      status: res.status,
      data: rpc && typeof rpc === 'object' && 'result' in rpc ? rpc.result : parsed,
      latencyMs: Date.now() - started,
    };
  } catch (err) {
    const message =
      err instanceof Error
        ? err.name === 'AbortError'
          ? `Remote MCP timed out after ${timeoutMs}ms`
          : err.message
        : 'Remote MCP call failed';
    return {
      ok: false,
      error: message,
      latencyMs: Date.now() - started,
    };
  } finally {
    clearTimeout(timer);
  }
}

export function bearerForService(serviceId: string): string | undefined {
  switch (serviceId) {
    case 'jira':
    case 'confluence':
    case 'bitbucket':
    case 'gitlab_boards':
      return getAtlassianAccessToken();
    case 'github':
    case 'github_enterprise':
    case 'github_projects':
      return process.env.MCP_GITHUB_TOKEN?.trim() || undefined;
    case 'notion':
      return process.env.MCP_NOTION_TOKEN?.trim() || undefined;
    default:
      return undefined;
  }
}
