import { api } from '@shared/api';
import type {
  EnterpriseMoveAnswers,
  ExpectationsAnswers,
  LiteOnboardingAnswers,
  OnboardingPlan,
  OnboardingProfile,
  RuntimeAnswers,
  ServiceCategory,
  ServiceId,
} from '@shared/types';

export const ONBOARDING_STORAGE_KEY = 'aplifyai-onboarding';

/**
 * Fresh wizard draft — no questionnaire answers pre-selected.
 * Stack suggestions are soft defaults the user can change on the services step.
 */
export function emptyOnboardingProfile(plan: OnboardingPlan = 'free'): OnboardingProfile {
  const now = new Date().toISOString();

  if (plan === 'enterprise') {
    return {
      plan,
      completedAt: null,
      selectedServices: [],
      otherByCategory: {},
      lite: {},
      enterprise: {
        move: {},
        expectations: {},
        runtime: {},
      },
      updatedAt: now,
    };
  }

  return {
    plan: 'free',
    completedAt: null,
    selectedServices: [],
    otherByCategory: {},
    lite: {},
    enterprise: { move: {}, expectations: {}, runtime: {} },
    updatedAt: now,
  };
}

export function isLiteAnswersComplete(lite?: LiteOnboardingAnswers): boolean {
  const intents =
    lite?.intents?.length ? lite.intents : lite?.intent ? [lite.intent] : [];
  return Boolean(intents.length > 0 && lite?.teamSize && (lite.biggestPains?.length ?? 0) > 0);
}

export function isEnterpriseMoveComplete(move?: EnterpriseMoveAnswers): boolean {
  return Boolean(
    (move?.goals?.length ?? 0) > 0 &&
      move?.buyerRole &&
      move?.orgSize &&
      (move.complianceNeeds?.length ?? 0) > 0 &&
      move?.timeline,
  );
}

export function isExpectationsComplete(expectations?: ExpectationsAnswers): boolean {
  return Boolean(
    typeof expectations?.speedMultiplier === 'number' &&
      (expectations.improveAreas?.length ?? 0) > 0 &&
      expectations.humanInTheLoop,
  );
}

export function isRuntimeComplete(runtime?: RuntimeAnswers): boolean {
  if (!runtime?.hosting) return false;
  if (runtime.hosting === 'customer_cloud' || runtime.hosting === 'private_vpc') {
    if (!runtime.cloudProvider) return false;
    if (runtime.cloudProvider === 'custom' && !runtime.customCloudLabel?.trim()) return false;
  }
  return Boolean(
    runtime.runtimeMode &&
      runtime.customModel &&
      runtime.codeOverrideStance &&
      runtime.tokenBudgetAppetite &&
      runtime.mcpAllowlistAggressiveness &&
      (runtime.regions?.length ?? 0) > 0,
  );
}

export function hasSelectedServices(profile: OnboardingProfile): boolean {
  return profile.selectedServices.length > 0;
}

export function readOnboardingProfile(): OnboardingProfile | null {
  try {
    const raw = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<OnboardingProfile>;
    if (parsed.plan !== 'free' && parsed.plan !== 'enterprise') return null;
    if (!Array.isArray(parsed.selectedServices)) return null;
    return {
      plan: parsed.plan,
      completedAt: typeof parsed.completedAt === 'string' ? parsed.completedAt : null,
      selectedServices: parsed.selectedServices as ServiceId[],
      otherByCategory: (parsed.otherByCategory ?? {}) as Partial<Record<ServiceCategory, string>>,
      lite: parsed.lite,
      enterprise: parsed.enterprise,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function writeOnboardingProfile(profile: OnboardingProfile): void {
  localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(profile));
}

export function clearOnboardingProfile(): void {
  localStorage.removeItem(ONBOARDING_STORAGE_KEY);
}

export function markOnboardingComplete(profile: OnboardingProfile): OnboardingProfile {
  const now = new Date().toISOString();
  return { ...profile, completedAt: now, updatedAt: now };
}

export function isOnboardingComplete(profile?: OnboardingProfile | null): boolean {
  const p = profile === undefined ? readOnboardingProfile() : profile;
  return typeof p?.completedAt === 'string' && p.completedAt.length > 0;
}

/** Where to send the user after a successful sign-in (sync fallback). */
export function postAuthPath(): '/onboarding' | '/console' | '/auth/workspace' {
  return isOnboardingComplete() ? '/console' : '/onboarding';
}

/**
 * Connection-aware landing: onboarding if incomplete, otherwise `/home` when the
 * active environment has ≥1 MCP connection, else `/console`.
 */
export async function resolvePostAuthLanding(): Promise<
  '/onboarding' | '/console' | '/home' | '/auth/workspace'
> {
  if (!isOnboardingComplete()) return '/onboarding';
  try {
    const { connections } = await api.listMcpConnections();
    const connected = connections.some((c) => c.status === 'connected');
    return connected ? '/home' : '/console';
  } catch {
    return '/console';
  }
}

/**
 * Pull this user's onboarding profile from the API into localStorage so gates
 * and post-auth redirects match server truth (not a stale browser draft).
 * Returns whether onboarding is complete after sync.
 */
export async function hydrateOnboardingFromServer(): Promise<boolean> {
  try {
    const { profile } = await api.getOnboarding();
    if (profile) {
      writeOnboardingProfile(profile);
      return isOnboardingComplete(profile);
    }
    // Server explicitly has no profile for this user — drop any leftover local draft
    // (e.g. another account on the same browser).
    clearOnboardingProfile();
    return false;
  } catch {
    // Transient/network errors: do not wipe a locally completed profile or the
    // user bounces back to the wizard after a successful save.
    return isOnboardingComplete();
  }
}
