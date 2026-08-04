/**
 * Signed stateless session auth + RBAC.
 * Tokens contain no secrets and survive restarts as long as AUTH_SESSION_SECRET is stable.
 */

import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { AuthSession, AuthUser, FederatedAuthProvider, LoginRequest, PlatformCapability } from '../../shared/types';
import { enrichAuthUser, roleHasPlatform } from './identity';
import { TENANT_ID, type Store } from './store';

const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h short-lived demo sessions

export type SessionAuthProvider = 'demo' | FederatedAuthProvider;

export interface SessionRecord {
  token: string;
  user: AuthUser;
  expiresAt: number;
}

interface SessionClaims {
  /** 1 = seeded demo user lookup; 2 = federated profile embedded in token */
  v: 1 | 2;
  sub: string;
  surface: 'web' | 'mobile';
  iat: number;
  exp: number;
  nonce: string;
  email?: string;
  displayName?: string;
  roleId?: string | null;
  tenantId?: string;
  isWorkspaceOwner?: boolean;
  authProvider?: SessionAuthProvider;
}

const SEEDED_USERS: AuthUser[] = [
  {
    id: 'usr-root-1',
    displayName: 'Asha Root',
    email: 'root@acme.demo',
    roleId: null,
    tenantId: TENANT_ID,
    surface: 'web',
    isWorkspaceOwner: true,
    workspaceSetupComplete: true,
  },
  {
    id: 'usr-manager-1',
    displayName: 'Marcus Manager',
    email: 'manager@acme.demo',
    roleId: null,
    tenantId: TENANT_ID,
    surface: 'web',
    isWorkspaceOwner: false,
    workspaceSetupComplete: true,
  },
  {
    id: 'usr-manager-mobile',
    displayName: 'Priya Manager',
    email: 'priya@acme.demo',
    roleId: null,
    tenantId: TENANT_ID,
    surface: 'mobile',
    isWorkspaceOwner: false,
    workspaceSetupComplete: true,
  },
  {
    id: 'usr-engineer-1',
    displayName: 'Dev Engineer',
    email: 'engineer@acme.demo',
    roleId: null,
    tenantId: TENANT_ID,
    surface: 'web',
    isWorkspaceOwner: false,
    workspaceSetupComplete: true,
  },
  {
    id: 'usr-auditor-1',
    displayName: 'Audit Viewer',
    email: 'auditor@acme.demo',
    roleId: null,
    tenantId: TENANT_ID,
    surface: 'web',
    isWorkspaceOwner: false,
    workspaceSetupComplete: true,
  },
];

export function listDemoUsers(): AuthUser[] {
  return SEEDED_USERS.map((u) => ({ ...u }));
}

export function demoAuthEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.AUTH_ALLOW_DEMO_LOGIN === '1';
}

const LOCAL_DEV_SESSION_SECRET = 'aplifyai-local-dev-session-secret-do-not-use-in-prod';
let warnedMissingSessionSecret = false;

function sessionSecret(): string {
  const configured = process.env.AUTH_SESSION_SECRET;
  if (configured && configured.length >= 32) return configured;
  // Vitest gets a deterministic, process-independent key. It is never accepted in production.
  if (process.env.NODE_ENV === 'test') return 'aplifyai-test-session-secret-32-bytes';
  // Local/demo: allow Continue as demo without a .env. Production still requires a real secret.
  if (process.env.NODE_ENV !== 'production') {
    if (!warnedMissingSessionSecret) {
      warnedMissingSessionSecret = true;
      console.warn(
        '[aplifyai-backend] AUTH_SESSION_SECRET missing or too short; using local-dev fallback. Set backend/.env for stable sessions across machines.',
      );
    }
    return LOCAL_DEV_SESSION_SECRET;
  }
  throw new Error('AUTH_SESSION_SECRET must be configured with at least 32 characters');
}

function encode(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function sign(unsigned: string): string {
  return createHmac('sha256', sessionSecret()).update(unsigned).digest('base64url');
}

function resolveIdentity(identity: string, surface: 'web' | 'mobile'): AuthUser | null {
  const key = identity.trim().toLowerCase();
  // Prefer the mobile-seeded manager profile for the default demo path.
  if ((key === 'manager' || key === 'member') && surface === 'mobile') {
    const mobile = SEEDED_USERS.find((u) => u.id === 'usr-manager-mobile')!;
    return { ...mobile, surface: 'mobile' };
  }
  // Legacy demo aliases: founder → workspace owner; member → limited engineer seat.
  if (key === 'founder' || key === 'founder@acme.demo' || key === 'usr-founder-1' || key === 'owner') {
    const root = SEEDED_USERS.find((u) => u.id === 'usr-root-1')!;
    return { ...root, surface };
  }
  if (key === 'member') {
    const engineer = SEEDED_USERS.find((u) => u.id === 'usr-engineer-1')!;
    return { ...engineer, surface };
  }
  const byEmail = SEEDED_USERS.find((u) => u.email.toLowerCase() === key);
  if (byEmail) return { ...byEmail, surface };
  const byId = SEEDED_USERS.find((u) => u.id === identity.trim());
  if (byId) return { ...byId, surface };
  // Legacy identity keys root|manager|engineer|auditor still resolve for tests / seat switcher.
  if (key === 'root') {
    return { ...SEEDED_USERS.find((u) => u.id === 'usr-root-1')!, surface };
  }
  if (key === 'manager') {
    return { ...SEEDED_USERS.find((u) => u.id === 'usr-manager-1')!, surface };
  }
  if (key === 'engineer') {
    return { ...SEEDED_USERS.find((u) => u.id === 'usr-engineer-1')!, surface };
  }
  if (key === 'auditor') {
    return { ...SEEDED_USERS.find((u) => u.id === 'usr-auditor-1')!, surface };
  }
  return null;
}

function mintSession(
  user: AuthUser,
  opts?: { authProvider?: SessionAuthProvider; federated?: boolean },
): AuthSession {
  const now = Date.now();
  const expiresAt = now + SESSION_TTL_MS;
  const federated = opts?.federated === true;
  const claims: SessionClaims = federated
    ? {
        v: 2,
        sub: user.id,
        surface: user.surface,
        iat: now,
        exp: expiresAt,
        nonce: randomBytes(16).toString('base64url'),
        email: user.email,
        displayName: user.displayName,
        roleId: user.roleId,
        tenantId: user.tenantId,
        isWorkspaceOwner: user.isWorkspaceOwner === true,
        authProvider: opts?.authProvider ?? 'okta',
      }
    : {
        v: 1,
        sub: user.id,
        surface: user.surface,
        iat: now,
        exp: expiresAt,
        nonce: randomBytes(16).toString('base64url'),
        authProvider: 'demo',
      };
  const unsigned = `oh1.${encode(claims)}`;
  const token = `${unsigned}.${sign(unsigned)}`;
  return {
    token,
    user,
    expiresAt: new Date(expiresAt).toISOString(),
  };
}

export function issueSession(body: LoginRequest): AuthSession | null {
  if (!demoAuthEnabled()) return null;
  const surface = body.surface ?? 'web';
  const user = resolveIdentity(body.identity, surface);
  if (!user) return null;
  return mintSession(user, { authProvider: 'demo', federated: false });
}

/** Issue a session for an IdP-authenticated user (Okta, Entra, Google, Apple, …). */
export function issueFederatedSession(
  user: AuthUser,
  authProvider: FederatedAuthProvider = 'okta',
): AuthSession {
  return mintSession(user, { authProvider, federated: true });
}

export function revokeSession(token: string): boolean {
  // Stateless sessions cannot be individually revoked. Keep the API idempotent;
  // clients must discard the token. Rotate AUTH_SESSION_SECRET for global revocation.
  return getSession(token) !== null;
}

export function getSession(token: string): SessionRecord | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3 || parts[0] !== 'oh1') return null;
    const unsigned = `${parts[0]}.${parts[1]}`;
    const actual = Buffer.from(parts[2]!, 'base64url');
    const expected = Buffer.from(sign(unsigned), 'base64url');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    const claims = JSON.parse(Buffer.from(parts[1]!, 'base64url').toString('utf8')) as Partial<SessionClaims>;
    if (
      (claims.v !== 1 && claims.v !== 2) ||
      typeof claims.sub !== 'string' ||
      (claims.surface !== 'web' && claims.surface !== 'mobile') ||
      typeof claims.exp !== 'number' ||
      claims.exp <= Date.now()
    ) {
      return null;
    }
    if (claims.v === 2) {
      if (
        typeof claims.email !== 'string' ||
        typeof claims.displayName !== 'string' ||
        typeof claims.tenantId !== 'string'
      ) {
        return null;
      }
      const roleId =
        claims.roleId === null || claims.roleId === undefined
          ? null
          : typeof claims.roleId === 'string'
            ? claims.roleId
            : null;
      const user: AuthUser = {
        id: claims.sub,
        email: claims.email,
        displayName: claims.displayName,
        roleId,
        tenantId: claims.tenantId,
        surface: claims.surface,
        isWorkspaceOwner: claims.isWorkspaceOwner === true,
      };
      return { token, user, expiresAt: claims.exp };
    }
    // Legacy demo token ids.
    const seeded =
      SEEDED_USERS.find((candidate) => candidate.id === claims.sub) ??
      (claims.sub === 'usr-founder-1' ? SEEDED_USERS.find((u) => u.id === 'usr-root-1') : undefined);
    if (!seeded) return null;
    const user = { ...seeded, surface: claims.surface };
    return { token, user, expiresAt: claims.exp };
  } catch {
    return null;
  }
}

/** Stateless sessions have no process-local state to clear. */
export function resetSessions(): void {
  // no-op
}

export type AuthedRequest = Request & {
  auth?: AuthUser;
  authToken?: string;
};

function extractBearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    return header.slice(7).trim() || null;
  }
  return null;
}

/**
 * Attach a user only from a valid signed Bearer token.
 */
export function attachAuth(req: AuthedRequest, _res: Response, next: NextFunction): void {
  const token = extractBearer(req);
  if (token) {
    const session = getSession(token);
    if (session) {
      req.auth = session.user;
      req.authToken = token;
      next();
      return;
    }
  }

  next();
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (!req.auth) {
    res.status(401).json({ error: 'authentication required' });
    return;
  }
  next();
}

/**
 * Allow if workspace owner or the user's custom role includes every listed capability.
 * Enriches req.auth from the tenant directory when a store is provided.
 */
export function requirePlatform(store: Store, ...capabilities: PlatformCapability[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      res.status(401).json({ error: 'authentication required' });
      return;
    }
    const user = enrichAuthUser(store, req.auth);
    req.auth = user;
    if (!roleHasPlatform(store, user, ...capabilities)) {
      res.status(403).json({ error: `requires capability: ${capabilities.join(' | ')}` });
      return;
    }
    next();
  };
}

export function actorFromAuth(req: AuthedRequest): { type: 'user' | 'manager_mobile'; id: string } {
  if (req.auth?.surface === 'mobile') {
    return { type: 'manager_mobile', id: req.auth.id };
  }
  if (req.auth) {
    return { type: 'user', id: req.auth.id };
  }
  return { type: 'user', id: 'anonymous' };
}

/** Stable fingerprint for audit (never log the raw token). */
export function tokenFingerprint(token: string): string {
  return createHash('sha256').update(token).digest('hex').slice(0, 12);
}
