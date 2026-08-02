/**
 * Workspace membership invites (sandbox).
 * Root invites by email → stub "email" is recorded → invitee SSO login accepts the role.
 * Credentials are never shared; invitees authenticate themselves.
 */

import type {
  AuthUser,
  CreateInviteResponse,
  InvitableRole,
  UserRole,
  WorkspaceInvite,
} from '../../shared/types';
import { nextId, TENANT_ID, type Store } from './store';

const INVITABLE: InvitableRole[] = ['manager', 'engineer', 'auditor'];

export function isInvitableRole(role: string): role is InvitableRole {
  return (INVITABLE as string[]).includes(role);
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function listInvites(store: Store, tenantId = TENANT_ID): WorkspaceInvite[] {
  return [...(store.invitesByTenant[tenantId] ?? [])].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

function inviteEmailPreview(invite: WorkspaceInvite, webOrigin: string): string {
  const join = `${webOrigin.replace(/\/$/, '')}/login?invite=${encodeURIComponent(invite.id)}`;
  return [
    `To: ${invite.email}`,
    `Subject: You're invited to AplifyAI (${invite.role})`,
    '',
    `${invite.invitedByEmail} invited you to join workspace ${invite.tenantId} as ${invite.role}.`,
    '',
    `Sign in with this email to accept: ${join}`,
    '',
    '(Sandbox: this message was not sent over SMTP — it is stored on the invite for demo.)',
  ].join('\n');
}

export function createInvite(
  store: Store,
  actor: AuthUser,
  input: { email: string; role: InvitableRole },
): CreateInviteResponse {
  if (actor.role !== 'root') {
    throw Object.assign(new Error('only root can invite users'), { status: 403 });
  }
  const email = normalizeEmail(input.email);
  if (!isValidEmail(email)) {
    throw Object.assign(new Error('a valid email is required'), { status: 400 });
  }
  if (!isInvitableRole(input.role)) {
    throw Object.assign(new Error('role must be manager, engineer, or auditor'), { status: 400 });
  }

  const existing = listInvites(store, actor.tenantId).find(
    (i) => i.email === email && i.status === 'pending',
  );
  if (existing) {
    throw Object.assign(new Error('a pending invite already exists for this email'), { status: 409 });
  }

  const now = new Date().toISOString();
  const invite: WorkspaceInvite = {
    id: nextId('inv'),
    tenantId: actor.tenantId,
    email,
    role: input.role,
    invitedByUserId: actor.id,
    invitedByEmail: actor.email,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
    acceptedAt: null,
    acceptedByUserId: null,
    lastEmailAt: null,
    lastEmailPreview: null,
  };

  const webOrigin = process.env.WEB_APP_ORIGIN?.trim() || 'http://localhost:3000';
  const preview = inviteEmailPreview(invite, webOrigin);
  invite.lastEmailAt = now;
  invite.lastEmailPreview = preview;

  if (!store.invitesByTenant[actor.tenantId]) store.invitesByTenant[actor.tenantId] = [];
  store.invitesByTenant[actor.tenantId]!.push(invite);
  store.emailOutbox.push({
    id: nextId('mail'),
    to: email,
    subject: `You're invited to AplifyAI (${invite.role})`,
    body: preview,
    createdAt: now,
    kind: 'workspace_invite',
    relatedId: invite.id,
  });

  return {
    invite,
    emailDelivery: { sent: true, channel: 'stub', preview },
  };
}

export function resendInvite(
  store: Store,
  actor: AuthUser,
  inviteId: string,
): CreateInviteResponse {
  if (actor.role !== 'root') {
    throw Object.assign(new Error('only root can resend invites'), { status: 403 });
  }
  const invite = listInvites(store, actor.tenantId).find((i) => i.id === inviteId);
  if (!invite) {
    throw Object.assign(new Error('invite not found'), { status: 404 });
  }
  if (invite.status !== 'pending') {
    throw Object.assign(new Error('only pending invites can be resent'), { status: 400 });
  }

  const now = new Date().toISOString();
  const webOrigin = process.env.WEB_APP_ORIGIN?.trim() || 'http://localhost:3000';
  const preview = inviteEmailPreview(invite, webOrigin);
  invite.lastEmailAt = now;
  invite.lastEmailPreview = preview;
  invite.updatedAt = now;

  store.emailOutbox.push({
    id: nextId('mail'),
    to: invite.email,
    subject: `You're invited to AplifyAI (${invite.role})`,
    body: preview,
    createdAt: now,
    kind: 'workspace_invite',
    relatedId: invite.id,
  });

  return {
    invite,
    emailDelivery: { sent: true, channel: 'stub', preview },
  };
}

export function revokeInvite(store: Store, actor: AuthUser, inviteId: string): WorkspaceInvite {
  if (actor.role !== 'root') {
    throw Object.assign(new Error('only root can revoke invites'), { status: 403 });
  }
  const invite = listInvites(store, actor.tenantId).find((i) => i.id === inviteId);
  if (!invite) {
    throw Object.assign(new Error('invite not found'), { status: 404 });
  }
  if (invite.status !== 'pending') {
    throw Object.assign(new Error('only pending invites can be revoked'), { status: 400 });
  }
  const now = new Date().toISOString();
  invite.status = 'revoked';
  invite.updatedAt = now;
  return invite;
}

/**
 * Apply pending invite role (login) or promote signup → root.
 * Prefer invite over default IdP role when email matches.
 */
export function resolveAccessForFederatedUser(
  store: Store,
  user: AuthUser,
  intent: 'login' | 'signup',
): AuthUser {
  const email = normalizeEmail(user.email);
  const pending = listInvites(store, user.tenantId).find(
    (i) => i.email === email && i.status === 'pending',
  );

  if (pending) {
    const now = new Date().toISOString();
    pending.status = 'accepted';
    pending.acceptedAt = now;
    pending.acceptedByUserId = user.id;
    pending.updatedAt = now;
    return { ...user, role: pending.role };
  }

  if (intent === 'signup') {
    return { ...user, role: 'root' satisfies UserRole };
  }

  return user;
}
