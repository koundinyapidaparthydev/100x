/**
 * Okta OIDC — thin wrappers over the shared federated OIDC engine.
 * Kept for backward-compatible imports and existing tests.
 */

import type { AuthUser } from '../../shared/types';
import {
  buildAuthorizeUrl,
  completeCallback,
  consumeExchange,
  getProviderConfig,
  mapClaimsToUser,
  providerStatus,
  resetFederatedPending,
  verifyIdToken,
  type AuthIntent,
} from './federatedOidc';

export type OktaIntent = AuthIntent;

export interface OktaStatus {
  enabled: boolean;
  issuer?: string;
  clientId?: string;
  redirectUri?: string;
}

export function getOktaConfig() {
  const cfg = getProviderConfig('okta');
  if (!cfg) return null;
  return {
    issuer: cfg.issuer,
    clientId: cfg.clientId,
    clientSecret: cfg.resolveClientSecret(),
    redirectUri: cfg.redirectUri,
    webAppOrigin: cfg.webAppOrigin,
    defaultRole: cfg.defaultRole,
    groupRoleMap: cfg.groupRoleMap,
  };
}

export function oktaStatus(): OktaStatus {
  const status = providerStatus('okta');
  if (!status.enabled) return { enabled: false };
  return {
    enabled: true,
    issuer: status.issuer,
    clientId: status.clientId,
    redirectUri: status.redirectUri,
  };
}

export function resetOktaPending(): void {
  resetFederatedPending();
}

export async function verifyOktaIdToken(
  idToken: string,
  opts: { issuer: string; clientId: string; nonce: string; jwksUri: string },
): Promise<Record<string, unknown>> {
  return verifyIdToken(idToken, { ...opts, label: 'Okta' });
}

export function mapOktaClaimsToUser(
  claims: Record<string, unknown>,
  cfg: NonNullable<ReturnType<typeof getOktaConfig>>,
  surface: 'web' | 'mobile',
): AuthUser {
  const runtime = getProviderConfig('okta');
  if (!runtime) throw new Error('Okta is not configured');
  // Prefer the passed cfg values (tests construct maps via env → getOktaConfig)
  return mapClaimsToUser(
    claims,
    {
      ...runtime,
      defaultRole: cfg.defaultRole,
      groupRoleMap: cfg.groupRoleMap,
    },
    surface,
  );
}

export async function buildOktaAuthorizeUrl(input: {
  intent: OktaIntent;
  surface: 'web' | 'mobile';
}): Promise<{ url: string; state: string }> {
  return buildAuthorizeUrl('okta', input);
}

export async function completeOktaCallback(input: {
  code: string;
  state: string;
}): Promise<{ exchangeCode: string; intent: OktaIntent; webAppOrigin: string }> {
  const result = await completeCallback('okta', input);
  return {
    exchangeCode: result.exchangeCode,
    intent: result.intent,
    webAppOrigin: result.webAppOrigin,
  };
}

export function consumeOktaExchange(exchangeCode: string): {
  session: { token: string; user: AuthUser; expiresAt: string };
  intent: OktaIntent;
} | null {
  const result = consumeExchange(exchangeCode);
  if (!result) return null;
  return { session: result.session, intent: result.intent };
}
