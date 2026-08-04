/**
 * McpGateway — deny-by-default tool surface for connected MCP providers.
 *
 * Demo mode does not spawn real MCP processes. Connecting a provider records
 * permission level + granted tool names; listTools / callTool honor that
 * allowlist. Real transports (stdio / HTTP / OAuth) plug in later behind the
 * same interface — each provider’s MCP server still enforces end-user ACLs.
 *
 * When a user role is supplied, tools must also pass the role’s mcp_access
 * grant (connection level ∩ role level).
 */

import {
  getMcpProvider,
  toolsForPermissionLevel,
  type McpPermissionLevel,
} from '../../../shared/mcpProviders';
import type { ServiceId, ServiceMcpConnection } from '../../../shared/types';
import { bearerForService, callRemoteMcpTool } from './remoteClient';
import { resolveTransport } from './transports';

export type McpCallResult = {
  ok: boolean;
  serverId: string;
  tool: string;
  latencyMs: number;
  bytes: number;
  data?: unknown;
  error?: string;
  transport?: 'stub' | 'remote_http' | 'stdio';
};

export type McpCallOpts = {
  store?: import('../store').Store;
  tenantId?: string;
  /**
   * When provided, tools must also be allowed at this role grant level
   * (intersected with the connection permission). `null` denies all tools.
   * Omit for system/orchestrator paths (connection allowlist only).
   */
  rolePermissionLevel?: McpPermissionLevel | null;
};

const LEVEL_RANK: Record<McpPermissionLevel, number> = { read: 0, write: 1, admin: 2 };

function toolAllowedAtLevel(
  connection: ServiceMcpConnection,
  tool: string,
  level: McpPermissionLevel,
): boolean {
  const provider = getMcpProvider(connection.serviceId);
  if (!provider) {
    return connection.grantedTools.includes(tool);
  }
  const allowed = new Set(toolsForPermissionLevel(provider, level).map((t) => t.name));
  return allowed.has(tool);
}

export function createConnection(
  serviceId: ServiceId,
  permissionLevel: McpPermissionLevel,
  opts?: {
    live?: boolean;
    authState?: ServiceMcpConnection['authState'];
    environmentId?: string;
  },
): ServiceMcpConnection {
  const provider = getMcpProvider(serviceId);
  const now = new Date().toISOString();
  const environmentId = opts?.environmentId?.trim() || 'env-prod';
  if (!provider || !provider.connectable) {
    return {
      serviceId,
      serverId: serviceId,
      environmentId,
      status: 'error',
      permissionLevel,
      grantedTools: [],
      connectedAt: null,
      updatedAt: now,
      lastError: 'No connectable MCP provider for this service',
      authState: 'error',
      live: false,
    };
  }
  if (!provider.permissionLevels.includes(permissionLevel)) {
    return {
      serviceId,
      serverId: provider.serverId,
      environmentId,
      status: 'error',
      permissionLevel,
      grantedTools: [],
      connectedAt: null,
      updatedAt: now,
      lastError: `Permission level '${permissionLevel}' is not offered for ${provider.serverId}`,
      authState: 'error',
      live: false,
    };
  }
  const granted = toolsForPermissionLevel(provider, permissionLevel).map((t) => t.name);
  return {
    serviceId,
    serverId: provider.serverId,
    environmentId,
    status: 'connected',
    permissionLevel,
    grantedTools: granted,
    connectedAt: now,
    updatedAt: now,
    live: opts?.live ?? false,
    authState: opts?.authState ?? 'ready',
  };
}

export function listGrantedTools(connection: ServiceMcpConnection): string[] {
  if (connection.status !== 'connected') return [];
  return [...connection.grantedTools];
}

function denyOrAllowlist(
  connection: ServiceMcpConnection,
  tool: string,
  started: number,
  rolePermissionLevel?: McpPermissionLevel | null,
): McpCallResult | null {
  if (connection.status !== 'connected') {
    return {
      ok: false,
      serverId: connection.serverId,
      tool,
      latencyMs: 0,
      bytes: 0,
      error: 'Provider is not connected',
    };
  }
  if (!connection.grantedTools.includes(tool)) {
    return {
      ok: false,
      serverId: connection.serverId,
      tool,
      latencyMs: Date.now() - started,
      bytes: 0,
      error: `Tool '${tool}' is not granted at permission level '${connection.permissionLevel}'`,
    };
  }
  if (rolePermissionLevel !== undefined) {
    if (rolePermissionLevel === null) {
      return {
        ok: false,
        serverId: connection.serverId,
        tool,
        latencyMs: Date.now() - started,
        bytes: 0,
        error: `Tool '${tool}' is not granted by the user's role for '${connection.serverId}'`,
      };
    }
    const effective: McpPermissionLevel =
      LEVEL_RANK[rolePermissionLevel] <= LEVEL_RANK[connection.permissionLevel]
        ? rolePermissionLevel
        : connection.permissionLevel;
    if (!toolAllowedAtLevel(connection, tool, effective)) {
      return {
        ok: false,
        serverId: connection.serverId,
        tool,
        latencyMs: Date.now() - started,
        bytes: 0,
        error: `Tool '${tool}' exceeds role grant '${rolePermissionLevel}' (effective '${effective}') for '${connection.serverId}'`,
      };
    }
  }
  return null;
}

function stubResult(
  connection: ServiceMcpConnection,
  tool: string,
  started: number,
): McpCallResult {
  const transport = resolveTransport(connection.serviceId);
  const payload = {
    demo: true,
    serverId: connection.serverId,
    tool,
    transport: transport.kind,
    endpoint: transport.ready ? transport.endpoint : undefined,
    note: transport.note,
  };
  const body = JSON.stringify(payload);
  return {
    ok: true,
    serverId: connection.serverId,
    tool,
    latencyMs: Date.now() - started,
    bytes: Buffer.byteLength(body),
    data: payload,
    transport: 'stub',
  };
}

/**
 * Sync tool invocation — deny-by-default + demo stub (no network).
 * Prefer `callToolAsync` when a remote transport may be configured.
 */
export function callTool(
  connection: ServiceMcpConnection,
  tool: string,
  _args: Record<string, unknown> = {},
  opts?: Pick<McpCallOpts, 'rolePermissionLevel'>,
): McpCallResult {
  const started = Date.now();
  const denied = denyOrAllowlist(connection, tool, started, opts?.rolePermissionLevel);
  if (denied) return denied;
  return stubResult(connection, tool, started);
}

/**
 * Async tool invocation — tries remote JSON-RPC when transport is ready,
 * otherwise falls back to the demo stub (including on remote failure).
 */
export async function callToolAsync(
  connection: ServiceMcpConnection,
  tool: string,
  args: Record<string, unknown> = {},
  opts?: McpCallOpts,
): Promise<McpCallResult> {
  const started = Date.now();
  const denied = denyOrAllowlist(connection, tool, started, opts?.rolePermissionLevel);
  if (denied) return denied;

  const transport = resolveTransport(connection.serviceId);
  const bearer = bearerForService(connection.serviceId, {
    store: opts?.store,
    tenantId: opts?.tenantId,
  });
  // Tenant PATs / OAuth tokens can unlock the default endpoint even when env.ready is false.
  if (transport.endpoint && (transport.ready || Boolean(bearer))) {
    const remote = await callRemoteMcpTool({
      endpoint: transport.endpoint,
      tool,
      args,
      bearerToken: bearer,
    });
    if (remote.ok) {
      const body = JSON.stringify(remote.data ?? {});
      return {
        ok: true,
        serverId: connection.serverId,
        tool,
        latencyMs: remote.latencyMs,
        bytes: Buffer.byteLength(body),
        data: remote.data,
        transport: 'remote_http',
      };
    }
    // Fall back to stub so demos keep working without live credentials.
    const stub = stubResult(connection, tool, started);
    return {
      ...stub,
      data: {
        ...(stub.data as object),
        remoteError: remote.error,
        remoteStatus: remote.status,
      },
    };
  }

  return stubResult(connection, tool, started);
}

/** Gather allowlisted context snippets for the enriching_mcp orchestrator step. */
export async function enrichFromConnections(
  connections: ServiceMcpConnection[],
  workItemKey: string,
  opts?: McpCallOpts,
): Promise<{ servers: string[]; snippets: string[]; calls: McpCallResult[] }> {
  const connected = connections.filter((c) => c.status === 'connected');
  const calls: McpCallResult[] = [];
  const snippets: string[] = [];
  for (const conn of connected) {
    const readTool = conn.grantedTools.find((t) => /get_|read_|search|list_/i.test(t));
    if (!readTool) continue;
    const result = await callToolAsync(conn, readTool, { issueKey: workItemKey }, opts);
    calls.push(result);
    if (result.ok) {
      snippets.push(
        `[${conn.serverId}/${readTool}] ${result.data ? JSON.stringify(result.data).slice(0, 400) : ''}`,
      );
    }
  }
  return {
    servers: connected.map((c) => c.serverId),
    snippets,
    calls,
  };
}

export function allowlistEntriesFromConnections(
  connections: ServiceMcpConnection[],
): Array<{ server: string; tools: string[] }> {
  return connections
    .filter((c) => c.status === 'connected' && c.grantedTools.length > 0)
    .map((c) => ({ server: c.serverId, tools: [...c.grantedTools] }));
}
