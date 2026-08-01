/**
 * Signed stateless session auth + RBAC.
 * Tokens contain no secrets and survive restarts as long as AUTH_SESSION_SECRET is stable.
 */

import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { AuthSession, AuthUser, LoginRequest, UserRole } from '../../shared/types';
import { TENANT_ID } from './store';

const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h short-lived demo sessions

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
  role?: UserRole;
  tenantId?: string;
  authProvider?: 'demo' | 'okta';
}

const SEEDED_USERS: AuthUser[] = [
  {
    id: 'usr-founder-1',
    displayName: 'Asha Founder',
    email: 'founder@acme.demo',
    role: 'founder',
    tenantId: TENANT_ID,
    surface: 'web',
  },
  {
    id: 'usr-manager-1',
    displayName: 'Marcus Manager',
    email: 'manager@acme.demo',
    role: 'manager',
    tenantId: TENANT_ID,
    surface: 'web',
  },
  {
    id: 'usr-manager-mobile',
    displayName: 'Priya Manager',
    email: 'priya@acme.demo',
    role: 'manager',
    tenantId: TENANT_ID,
    surface: 'mobile',
  },
  {
    id: 'usr-engineer-1',
    displayName: 'Dev Engineer',
    email: 'engineer@acme.demo',
    role: 'engineer',
    tenantId: TENANT_ID,
    surface: 'web',
  },
  {
    id: 'usr-auditor-1',
    displayName: 'Audit Viewer',
    email: 'auditor@acme.demo',
    role: 'auditor',
    tenantId: TENANT_ID,
    surface: 'web',
  },
];

export function listDemoUsers(): AuthUser[] {
  return SEEDED_USERS.map((u) => ({ ...u }));
}

export function demoAuthEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.AUTH_ALLOW_DEMO_LOGIN === '1';
}

function sessionSecret(): string {
  const configured = process.env.AUTH_SESSION_SECRET;
  if (configured && configured.length >= 32) return configured;
  // Vitest gets a deterministic, process-independent key. It is never accepted in production.
  if (process.env.NODE_ENV === 'test') return 'aplifyai-test-session-secret-32-bytes';
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
  const byRole = SEEDED_USERS.find((u) => u.role === key && (surface === 'mobile' ? u.role === 'manager' : true));
  if (key === 'manager' && surface === 'mobile') {
    const mobile = SEEDED_USERS.find((u) => u.id === 'usr-manager-mobile')!;
    return { ...mobile, surface: 'mobile' };
  }
  if (byRole) return { ...byRole, surface };
  const byEmail = SEEDED_USERS.find((u) => u.email.toLowerCase() === key);
  if (byEmail) return { ...byEmail, surface };
  const byId = SEEDED_USERS.find((u) => u.id === identity.trim());
  if (byId) return { ...byId, surface };
  return null;
}

function mintSession(user: AuthUser, opts?: { authProvider?: 'demo' | 'okta'; federated?: boolean }): AuthSession {
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
        role: user.role,
        tenantId: user.tenantId,
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

/** Issue a session for an Okta (or other IdP) authenticated user. */
export function issueFederatedSession(user: AuthUser, authProvider: 'okta' = 'okta'): AuthSession {
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
        typeof claims.role !== 'string' ||
        typeof claims.tenantId !== 'string' ||
        !['founder', 'manager', 'engineer', 'auditor'].includes(claims.role)
      ) {
        return null;
      }
      const user: AuthUser = {
        id: claims.sub,
        email: claims.email,
        displayName: claims.displayName,
        role: claims.role,
        tenantId: claims.tenantId,
        surface: claims.surface,
      };
      return { token, user, expiresAt: claims.exp };
    }
    const seeded = SEEDED_USERS.find((candidate) => candidate.id === claims.sub);
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

export function requireRoles(...roles: UserRole[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      res.status(401).json({ error: 'authentication required' });
      return;
    }
    if (!roles.includes(req.auth.role)) {
      res.status(403).json({ error: `requires role: ${roles.join(' | ')}` });
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
