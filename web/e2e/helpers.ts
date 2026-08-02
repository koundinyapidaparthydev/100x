import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { emptyOnboardingProfile, markOnboardingComplete } from '../src/lib/onboardingStorage';

export const DEMO_SESSION_KEY = 'aplifyai-demo-session';
export const ONBOARDING_STORAGE_KEY = 'aplifyai-onboarding';

export type DemoIdentity = 'manager' | 'founder' | 'engineer';

type LoginResponse = {
  session: {
    token: string;
    user: { id: string; role: string };
    expiresAt: string;
  };
};

export type TestWorkItem = {
  id: string;
  board: { projectId: string; issueKey: string };
};

/** Mark workspace onboarding complete so RequireOnboarding allows the app shell. */
export async function injectCompletedOnboarding(page: Page): Promise<void> {
  const profile = markOnboardingComplete(emptyOnboardingProfile('free'));
  await page.addInitScript(
    ({ key, value }) => {
      localStorage.setItem(key, value);
    },
    { key: ONBOARDING_STORAGE_KEY, value: JSON.stringify(profile) },
  );
}

/** Login via Workspace owner / Team member UI (maps to founder|manager|engineer). */
export async function loginAs(page: Page, identity: DemoIdentity = 'manager'): Promise<void> {
  await injectCompletedOnboarding(page);
  await page.goto('/login');
  await expect(page.getByTestId('login-page')).toBeVisible();
  // One-click demo path (full founder access) — preferred for building-stage walkthroughs.
  if (identity === 'founder') {
    await page.getByTestId('login-continue-demo').click();
  } else {
    await page.getByTestId('login-toggle-seats').click();
    await page.getByTestId('login-mode-member').click();
    await page.getByTestId(`login-member-${identity}`).click();
    await page.getByTestId(`login-${identity}`).click();
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
  const profile = markOnboardingComplete(emptyOnboardingProfile('free'));
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
        role: body.session.user.role,
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
