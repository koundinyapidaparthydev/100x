import { api, getSessionToken } from '@shared/api';
import type { OnboardingPlan, OnboardingProfile, ServiceCategory, ServiceId } from '@shared/types';

export const ONBOARDING_STORAGE_KEY = 'aplifyai-onboarding';

/** Sensible starter defaults so users can continue with light edits. */
export function emptyOnboardingProfile(plan: OnboardingPlan = 'free'): OnboardingProfile {
  const now = new Date().toISOString();

  if (plan === 'enterprise') {
    return {
      plan,
      completedAt: null,
      selectedServices: ['jira', 'slack', 'github', 'confluence'],
      otherByCategory: {},
      lite: {},
      enterprise: {
        move: {
          goals: ['Centralize triage', 'Ship AI-assisted delivery'],
          buyerRole: 'delivery_lead',
          orgSize: '21-100',
          complianceNeeds: ['SOC2', 'Internal only'],
          timeline: 'this_quarter',
        },
        expectations: {
          speedMultiplier: 20,
          improveAreas: ['Cycle time', 'Quality'],
          aiCompletionTargetPercent: 20,
          humanInTheLoop: 'high_risk',
        },
        runtime: {
          // Default: AplifyAI private cloud; user can switch to connected accounts or BYOC.
          hosting: 'public_managed',
          cloudProvider: 'private',
          runtimeMode: 'request_based',
          customModel: 'none',
          codeOverrideStance: 'allowed_with_audit',
          tokenBudgetAppetite: 'balanced',
          mcpAllowlistAggressiveness: 'balanced',
          regions: ['eastus'],
        },
      },
      updatedAt: now,
    };
  }

  return {
    plan: 'free',
    completedAt: null,
    selectedServices: ['jira', 'slack', 'github'],
    otherByCategory: {},
    lite: {
      intent: 'triage',
      teamSize: '6-20',
      biggestPains: ['Triage backlog', 'Tool sprawl'],
      urgency: 'this_month',
      primaryBoards: ['jira'],
    },
    enterprise: { move: {}, expectations: { speedMultiplier: 20 }, runtime: {} },
    updatedAt: now,
  };
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

/** Where to send the user after a successful sign-in. */
export function postAuthPath(): '/onboarding' | '/projects' {
  return isOnboardingComplete() ? '/projects' : '/onboarding';
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
    // Server has no profile for this user — do not keep a stale local completedAt
    // (e.g. leftover from a prior demo account on the same browser).
    clearOnboardingProfile();
    return false;
  } catch {
    // Fail closed when a session exists: never trust a leftover local completedAt
    // if the API cannot confirm (old backend, network blip, 401 race).
    if (getSessionToken() || hasDemoSessionInStorage()) {
      clearOnboardingProfile();
      return false;
    }
  }
  return isOnboardingComplete();
}

function hasDemoSessionInStorage(): boolean {
  try {
    return Boolean(localStorage.getItem('aplifyai-demo-session'));
  } catch {
    return false;
  }
}
