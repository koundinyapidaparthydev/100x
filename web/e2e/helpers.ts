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

/** Login via UI (manager/founder/engineer buttons). */
export async function loginAs(page: Page, identity: DemoIdentity = 'manager'): Promise<void> {
  await page.goto('/login');
  await expect(page.getByTestId('login-page')).toBeVisible();
  await page.getByTestId(`login-${identity}`).click();
  await expect(page.getByTestId('dashboard-heading')).toBeVisible({ timeout: 20_000 });
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
export async function findUntreatedWorkItemId(request: APIRequestContext): Promise<string> {
  const res = await request.get('/api/v1/work-items?triagePending=true');
  expect(res.ok()).toBeTruthy();
  const items = (await res.json()) as Array<{ id: string }>;
  expect(items.length).toBeGreaterThan(0);
  return items[0]!.id;
}
