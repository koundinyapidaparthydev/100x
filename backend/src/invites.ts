/**
 * Workspace membership invites (sandbox).
 * Owner invites by email → stub/SendGrid email is recorded → invitee SSO login accepts the role.
 * Credentials are never shared; invitees authenticate themselves.
 */

import type { AuthUser, CreateInviteResponse, InviteEmailChannel, WorkspaceInvite } from '../../shared/types';
import { enrichAuthUser, findCustomRole, roleHasPlatform, upsertTenantUserFromAuth } from './identity';
import { sendWithSendgrid, sendgridConfigured } from './mail/sendgrid';
import { nextId, TENANT_ID, type Store } from './store';

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
    `Subject: You're invited to 100x`,
    '',
    `${invite.invitedByEmail} invited you to join workspace ${invite.tenantId}.`,
    `Assigned role id: ${invite.roleId}`,
    '',
    `Sign in with this email to accept: ${join}`,
    '',
    '(Sandbox: this message was not sent over SMTP — it is stored on the invite for demo.)',
  ].join('\n');
}

async function deliverInviteEmail(
  store: Store,
  invite: WorkspaceInvite,
  preview: string,
): Promise<CreateInviteResponse['emailDelivery']> {
  const subject = `You're invited to 100x`;
  const now = new Date().toISOString();
  let channel: InviteEmailChannel = 'stub';
  let messageId: string | null = null;

  if (sendgridConfigured()) {
    try {
      const html = preview
        .split('\n')
        .map((line) => `<div>${line.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</div>`)
        .join('');
      const sent = await sendWithSendgrid({
        to: invite.email,
        subject,
        text: preview,
        html: `<pre style="font-family:system-ui,sans-serif;white-space:pre-wrap">${html}</pre>`,
        customArgs: { inviteId: invite.id, tenantId: invite.tenantId },
      });
      channel = 'sendgrid';
      messageId = sent.messageId;
    } catch {
      channel = 'stub';
      messageId = null;
    }
  }

  store.emailOutbox.push({
    id: nextId('mail'),
    to: invite.email,
    subject,
    body: preview,
    createdAt: now,
    kind: 'workspace_invite',
    relatedId: invite.id,
  });

  return { sent: true, channel, preview, messageId };
}

export async function createInvite(
  store: Store,
  actor: AuthUser,
  input: { email: string; roleId: string },
): Promise<CreateInviteResponse> {
  if (!roleHasPlatform(store, actor, 'invites.manage')) {
    throw Object.assign(new Error('requires capability: invites.manage'), { status: 403 });
  }
  const email = normalizeEmail(input.email);
  if (!isValidEmail(email)) {
    throw Object.assign(new Error('a valid email is required'), { status: 400 });
  }
  const roleId = typeof input.roleId === 'string' ? input.roleId.trim() : '';
  if (!roleId || !findCustomRole(store, roleId, actor.tenantId)) {
    throw Object.assign(new Error('roleId must reference an existing custom role'), { status: 400 });
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
    roleId,
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

  const delivery = await deliverInviteEmail(store, invite, preview);

  return {
    invite,
    emailDelivery: delivery,
  };
}

export async function resendInvite(
  store: Store,
  actor: AuthUser,
  inviteId: string,
): Promise<CreateInviteResponse> {
  if (!roleHasPlatform(store, actor, 'invites.manage')) {
    throw Object.assign(new Error('requires capability: invites.manage'), { status: 403 });
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

  const delivery = await deliverInviteEmail(store, invite, preview);

  return {
    invite,
    emailDelivery: delivery,
  };
}

export function revokeInvite(store: Store, actor: AuthUser, inviteId: string): WorkspaceInvite {
  if (!roleHasPlatform(store, actor, 'invites.manage')) {
    throw Object.assign(new Error('requires capability: invites.manage'), { status: 403 });
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
 * Apply pending invite role (login) or promote signup → workspace owner.
 * Prefer invite over default IdP role when email matches.
 * Always upserts the user into the tenant directory.
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

  let resolved: AuthUser = user;

  if (pending) {
    const now = new Date().toISOString();
    pending.status = 'accepted';
    pending.acceptedAt = now;
    pending.acceptedByUserId = user.id;
    pending.updatedAt = now;
    resolved = {
      ...user,
      roleId: pending.roleId,
      isWorkspaceOwner: false,
      workspaceSetupComplete: true,
    };
  } else if (intent === 'signup') {
    resolved = {
      ...user,
      roleId: null,
      isWorkspaceOwner: true,
      workspaceSetupComplete: false,
    };
  } else {
    // Returning login: keep the directory role instead of re-applying IdP default.
    const existing = store.usersByTenant[user.tenantId]?.find((u) => u.id === user.id);
    if (existing) {
      resolved = {
        ...user,
        roleId: existing.roleId,
        isWorkspaceOwner: existing.isWorkspaceOwner,
        workspaceSetupComplete: existing.workspaceSetupComplete,
        companyDomain: existing.companyDomain ?? undefined,
        linkedEmails: existing.linkedEmails.length ? [...existing.linkedEmails] : undefined,
      };
    }
  }

  upsertTenantUserFromAuth(store, resolved, {
    isNewSignup: intent === 'signup',
    fromInvite: Boolean(pending),
  });
  return enrichAuthUser(store, resolved);
}
