import { expect, type APIRequestContext, type Page } from '@playwright/test';

export const DEMO_SESSION_KEY = 'aplifyai-demo-session';

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

/** Login via Workspace owner / Team member UI (maps to founder|manager|engineer). */
export async function loginAs(page: Page, identity: DemoIdentity = 'manager'): Promise<void> {
  await page.goto('/login');
  await expect(page.getByTestId('login-page')).toBeVisible();
  if (identity === 'founder') {
    await page.getByTestId('login-mode-owner').click();
  } else {
    await page.getByTestId('login-mode-member').click();
    await page.getByTestId(`login-member-${identity}`).click();
  }
  await page.getByTestId(`login-${identity}`).click();
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
  await page.addInitScript(
    ({ key, session }) => {
      localStorage.setItem(key, JSON.stringify(session));
    },
    {
      key: DEMO_SESSION_KEY,
      session: {
        token: body.session.token,
        id: body.session.user.id,
        role: body.session.user.role,
        surface: 'web',
      },
    },
  );
}

export async function clearBrowserSession(page: Page): Promise<void> {
  await page.goto('/login');
  await page.evaluate((key) => localStorage.removeItem(key), DEMO_SESSION_KEY);
}

/** Find a seed work item that has not been triaged yet (aiStatus none). */
export async function findUntreatedWorkItem(request: APIRequestContext): Promise<TestWorkItem> {
  const res = await request.get('/api/v1/work-items?triagePending=true');
  expect(res.ok()).toBeTruthy();
  const items = (await res.json()) as TestWorkItem[];
  expect(items.length).toBeGreaterThan(0);
  return items[0]!;
}
