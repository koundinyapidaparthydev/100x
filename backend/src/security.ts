/**
 * Per-user security settings: 2FA flags, passkeys, platform access keys (sandbox stubs).
 */

import { randomBytes } from 'node:crypto';
import type {
  AuthUser,
  CreateAccessKeyRequest,
  CreateAccessKeyResponse,
  CreatePasskeyRequest,
  PlatformAccessKey,
  RegisteredPasskey,
  UpdateSecuritySettingsRequest,
  UserSecuritySettings,
} from '../../shared/types';
import { nextId, type Store } from './store';

function defaultSettings(user: AuthUser): UserSecuritySettings {
  const now = new Date().toISOString();
  return {
    userId: user.id,
    tenantId: user.tenantId,
    twoFactorEnabled: false,
    twoFactorRequired: false,
    passkeysEnabled: true,
    passkeys: [],
    accessKeys: [],
    updatedAt: now,
  };
}

export function getSecuritySettings(store: Store, user: AuthUser): UserSecuritySettings {
  const existing = store.securityByUser[user.id];
  if (existing) return existing;
  const created = defaultSettings(user);
  store.securityByUser[user.id] = created;
  return created;
}

export function updateSecuritySettings(
  store: Store,
  user: AuthUser,
  input: UpdateSecuritySettingsRequest,
): UserSecuritySettings {
  const settings = getSecuritySettings(store, user);
  if (typeof input.twoFactorEnabled === 'boolean') {
    settings.twoFactorEnabled = input.twoFactorEnabled;
    if (!input.twoFactorEnabled) settings.twoFactorRequired = false;
  }
  if (typeof input.twoFactorRequired === 'boolean') {
    if (input.twoFactorRequired && !settings.twoFactorEnabled) {
      throw Object.assign(new Error('enable 2FA before requiring it'), { status: 400 });
    }
    settings.twoFactorRequired = input.twoFactorRequired;
  }
  if (typeof input.passkeysEnabled === 'boolean') {
    settings.passkeysEnabled = input.passkeysEnabled;
  }
  settings.updatedAt = new Date().toISOString();
  return settings;
}

export function registerPasskey(
  store: Store,
  user: AuthUser,
  input: CreatePasskeyRequest,
): UserSecuritySettings {
  const settings = getSecuritySettings(store, user);
  if (!settings.passkeysEnabled) {
    throw Object.assign(new Error('passkeys are disabled for this account'), { status: 400 });
  }
  const name = input.name?.trim();
  if (!name) {
    throw Object.assign(new Error('passkey name is required'), { status: 400 });
  }
  const passkey: RegisteredPasskey = {
    id: nextId('pk'),
    name,
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
  };
  settings.passkeys.push(passkey);
  settings.updatedAt = new Date().toISOString();
  return settings;
}

export function revokePasskey(store: Store, user: AuthUser, passkeyId: string): UserSecuritySettings {
  const settings = getSecuritySettings(store, user);
  const before = settings.passkeys.length;
  settings.passkeys = settings.passkeys.filter((p) => p.id !== passkeyId);
  if (settings.passkeys.length === before) {
    throw Object.assign(new Error('passkey not found'), { status: 404 });
  }
  settings.updatedAt = new Date().toISOString();
  return settings;
}

export function createAccessKey(
  store: Store,
  user: AuthUser,
  input: CreateAccessKeyRequest,
): CreateAccessKeyResponse {
  const settings = getSecuritySettings(store, user);
  const name = input.name?.trim();
  if (!name) {
    throw Object.assign(new Error('access key name is required'), { status: 400 });
  }
  const raw = randomBytes(24).toString('base64url');
  const secret = `apk_${raw}`;
  const prefix = `${secret.slice(0, 10)}…`;
  const key: PlatformAccessKey = {
    id: nextId('apk'),
    name,
    prefix,
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
    revokedAt: null,
  };
  settings.accessKeys.unshift(key);
  settings.updatedAt = new Date().toISOString();
  return { key, secret, settings };
}

export function revokeAccessKey(
  store: Store,
  user: AuthUser,
  keyId: string,
): UserSecuritySettings {
  const settings = getSecuritySettings(store, user);
  const key = settings.accessKeys.find((k) => k.id === keyId);
  if (!key) {
    throw Object.assign(new Error('access key not found'), { status: 404 });
  }
  if (!key.revokedAt) {
    key.revokedAt = new Date().toISOString();
    settings.updatedAt = new Date().toISOString();
  }
  return settings;
}
