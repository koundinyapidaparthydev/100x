import { expect, type APIRequestContext, type Page } from '@playwright/test';
import type { OnboardingProfile } from '@shared/types';
import { emptyOnboardingProfile, markOnboardingComplete } from '../src/lib/onboardingStorage';

export const DEMO_SESSION_KEY = '100x-demo-session';
export const ONBOARDING_STORAGE_KEY = '100x-onboarding';

/** Demo seat identities — prefer root for privileged flows; engineer/member for negative RBAC. */
export type DemoIdentity = 'manager' | 'root' | 'engineer' | 'member';

type LoginResponse = {
  session: {
    token: string;
    user: { id: string; roleId: string | null; isWorkspaceOwner?: boolean };
    expiresAt: string;
  };
};

export type TestWorkItem = {
  id: string;
  board: { projectId: string; issueKey: string };
};

/** Completed profile for app-shell e2e — includes a typical stack so Connections is usable. */
function completedTestOnboarding(): OnboardingProfile {
  return markOnboardingComplete({
    ...emptyOnboardingProfile('free'),
    selectedServices: ['jira', 'slack', 'github'],
    lite: {
      intents: ['triage'],
      intent: 'triage',
      teamSize: '6-20',
      biggestPains: ['Triage backlog'],
      urgency: 'this_month',
      primaryBoards: ['jira'],
    },
  });
}

function seatFromLogin(user: LoginResponse['session']['user'], identity: DemoIdentity): string {
  if (user.isWorkspaceOwner || identity === 'root') return 'root';
  if (identity === 'manager') return 'manager';
  if (identity === 'auditor' as string) return 'auditor';
  return 'member';
}

function apiIdentityFor(identity: DemoIdentity): 'root' | 'engineer' | 'member' {
  if (identity === 'root' || identity === 'manager') return 'root';
  if (identity === 'engineer') return 'engineer';
  return 'member';
}

/** Persist onboarding on the API so hydrateOnboardingFromServer does not wipe local drafts. */
async function persistOnboarding(
  request: APIRequestContext,
  token: string,
  profile: OnboardingProfile,
): Promise<void> {
  const res = await request.put('/api/v1/onboarding', {
    headers: { Authorization: `Bearer ${token}` },
    data: { profile },
  });
  expect(res.ok()).toBeTruthy();
}

/** Clear server-side completion for the demo owner so wizard e2e can re-run. */
export async function resetOwnerOnboarding(request: APIRequestContext): Promise<void> {
  const loginRes = await request.post('/api/v1/auth/login', {
    data: { identity: 'root', surface: 'web' },
  });
  expect(loginRes.ok()).toBeTruthy();
  const body = (await loginRes.json()) as LoginResponse;
  const draft = {
    ...emptyOnboardingProfile('free'),
    completedAt: null,
  };
  await persistOnboarding(request, body.session.token, draft);
}

type StoredSession = {
  token: string;
  id: string;
  role: string;
  surface: string;
};

/** One-shot localStorage seed — avoid addInitScript so logout stays cleared on later navigations. */
async function writeLocalAuth(
  page: Page,
  session: StoredSession,
  profile: OnboardingProfile,
): Promise<void> {
  await page.goto('/login');
  await page.evaluate(
    ({ sessionKey, sessionValue, onboardingKey, onboarding }) => {
      localStorage.setItem(sessionKey, JSON.stringify(sessionValue));
      localStorage.setItem(onboardingKey, onboarding);
    },
    {
      sessionKey: DEMO_SESSION_KEY,
      sessionValue: session,
      onboardingKey: ONBOARDING_STORAGE_KEY,
      onboarding: JSON.stringify(profile),
    },
  );
}

/** Mark workspace onboarding complete so RequireOnboarding allows the app shell. */
export async function injectCompletedOnboarding(page: Page): Promise<void> {
  const profile = completedTestOnboarding();
  await page.goto('/login');
  await page.evaluate(
    ({ key, value }) => {
      localStorage.setItem(key, value);
    },
    { key: ONBOARDING_STORAGE_KEY, value: JSON.stringify(profile) },
  );
}

/**
 * Login via API + local seed, then land on resolvePostAuthLanding (/home|/console).
 * Seeds completed onboarding on the server so post-login hydrate stays complete.
 */
export async function loginAs(page: Page, identity: DemoIdentity = 'root'): Promise<void> {
  const profile = completedTestOnboarding();
  const loginRes = await page.request.post('/api/v1/auth/login', {
    data: { identity: apiIdentityFor(identity), surface: 'web' },
  });
  expect(loginRes.ok()).toBeTruthy();
  const body = (await loginRes.json()) as LoginResponse;
  await persistOnboarding(page.request, body.session.token, profile);

  await writeLocalAuth(
    page,
    {
      token: body.session.token,
      id: body.session.user.id,
      role: seatFromLogin(body.session.user, identity),
      surface: 'web',
    },
    profile,
  );

  // Login page hydrates from server and redirects via resolvePostAuthLanding.
  await page.goto('/login');
  await expect(page).toHaveURL(/\/(home|console)(\/|$|\?)/, { timeout: 20_000 });
  await expect(page.getByTestId('topbar')).toBeVisible();
}

/** Seed a Bearer session into localStorage before navigation (for role switches). */
export async function injectSession(
  page: Page,
  request: APIRequestContext,
  identity: DemoIdentity,
): Promise<void> {
  const res = await request.post('/api/v1/auth/login', {
    data: { identity: apiIdentityFor(identity), surface: 'web' },
  });
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as LoginResponse;
  const profile = completedTestOnboarding();
  await persistOnboarding(request, body.session.token, profile);
  await writeLocalAuth(
    page,
    {
      token: body.session.token,
      id: body.session.user.id,
      role: seatFromLogin(body.session.user, identity),
      surface: 'web',
    },
    profile,
  );
}

export async function clearBrowserSession(page: Page): Promise<void> {
  await page.goto('/login');
  await page.evaluate(
    ({ sessionKey, onboardingKey }) => {
      localStorage.removeItem(sessionKey);
      localStorage.removeItem(onboardingKey);
    },
    { sessionKey: DEMO_SESSION_KEY, onboardingKey: ONBOARDING_STORAGE_KEY },
  );
}

/** Fetch triage-pending work items (`lastTriageDecision=null` && `aiStatus=none`). */
export async function listTriagePending(request: APIRequestContext): Promise<TestWorkItem[]> {
  const res = await request.get('/api/v1/work-items?triagePending=true');
  expect(res.ok()).toBeTruthy();
  return (await res.json()) as TestWorkItem[];
}

/**
 * Assert the in-memory demo seed still has a deep swipe/triage deck.
 * Fresh backend targets 18 pending (inside 15–22). Call early in a run before many triage mutations.
 */
export async function assertFreshTriagePendingCount(
  request: APIRequestContext,
  opts?: { min?: number; max?: number },
): Promise<number> {
  const min = opts?.min ?? 15;
  const max = opts?.max ?? 22;
  const items = await listTriagePending(request);
  expect(
    items.length,
    `expected triage-pending count in [${min}, ${max}] (fresh seed ≈18), got ${items.length}`,
  ).toBeGreaterThanOrEqual(min);
  expect(items.length).toBeLessThanOrEqual(max);
  return items.length;
}

/** Find a seed work item that has not been triaged yet (aiStatus none). */
export async function findUntreatedWorkItem(request: APIRequestContext): Promise<TestWorkItem> {
  const items = await listTriagePending(request);
  expect(items.length).toBeGreaterThan(0);
  return items[0]!;
}
