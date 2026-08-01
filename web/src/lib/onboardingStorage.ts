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
          hosting: 'private_vpc',
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
