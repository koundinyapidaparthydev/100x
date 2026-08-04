import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { emptyOnboardingProfile, markOnboardingComplete } from '../src/lib/onboardingStorage';

export const DEMO_SESSION_KEY = 'aplifyai-demo-session';
export const ONBOARDING_STORAGE_KEY = 'aplifyai-onboarding';

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
function completedTestOnboarding() {
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

/** Mark workspace onboarding complete so RequireOnboarding allows the app shell. */
export async function injectCompletedOnboarding(page: Page): Promise<void> {
  const profile = completedTestOnboarding();
  await page.addInitScript(
    ({ key, value }) => {
      localStorage.setItem(key, value);
    },
    { key: ONBOARDING_STORAGE_KEY, value: JSON.stringify(profile) },
  );
}

/**
 * Login via UI for owner, or API inject for limited members.
 * Privileged product walks use root (workspace owner).
 */
export async function loginAs(page: Page, identity: DemoIdentity = 'root'): Promise<void> {
  await injectCompletedOnboarding(page);
  await page.goto('/login');
  await expect(page.getByTestId('login-page')).toBeVisible();
  if (identity === 'root' || identity === 'manager') {
    // Manager no longer has built-in privileges — privileged e2e use owner.
    await page.getByTestId('login-continue-demo').click();
  } else {
    await page.getByTestId('login-toggle-seats').click();
    await page.getByTestId('login-mode-member').click();
    await page.getByTestId('login-member-member').click();
    await page.getByTestId('login-member').click();
  }
  await expect(page).toHaveURL(/\/projects$/, { timeout: 20_000 });
  await expect(page.getByTestId('boards-page')).toBeVisible();
}

/** Seed a Bearer session into localStorage before navigation (for role switches). */
export async function injectSession(
  page: Page,
  request: APIRequestContext,
  identity: DemoIdentity,
): Promise<void> {
  const res = await request.post('/api/v1/auth/login', {
    data: { identity, surface: 'web' },
  });
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as LoginResponse;
  const profile = completedTestOnboarding();
  await page.addInitScript(
    ({ sessionKey, session, onboardingKey, onboarding }) => {
      localStorage.setItem(sessionKey, JSON.stringify(session));
      localStorage.setItem(onboardingKey, onboarding);
    },
    {
      sessionKey: DEMO_SESSION_KEY,
      session: {
        token: body.session.token,
        id: body.session.user.id,
        role: seatFromLogin(body.session.user, identity),
        surface: 'web',
      },
      onboardingKey: ONBOARDING_STORAGE_KEY,
      onboarding: JSON.stringify(profile),
    },
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

/** Find a seed work item that has not been triaged yet (aiStatus none). */
export async function findUntreatedWorkItem(request: APIRequestContext): Promise<TestWorkItem> {
  const res = await request.get('/api/v1/work-items?triagePending=true');
  expect(res.ok()).toBeTruthy();
  const items = (await res.json()) as TestWorkItem[];
  expect(items.length).toBeGreaterThan(0);
  return items[0]!;
}
