import { expect, test } from '@playwright/test';
import { clearBrowserSession } from './helpers';

/**
 * Code MVP web smokes (TEST_MVP 55–58). Seeds via POST /demo/run so the
 * shared Playwright backend does not need DEMO_SEED on every suite.
 */
test.describe('Code MVP demo path', () => {
  test('board shows three MVP tickets, AI-first on A, audit after job', async ({ page, request }) => {
    const seed = await request.post('/api/v1/demo/run');
    expect(seed.ok()).toBeTruthy();
    const seeded = (await seed.json()) as { job?: { state?: string } };
    expect(seeded.job?.state).toBe('ready_for_human');

    await clearBrowserSession(page);
    await page.goto('/login');
    await expect(page.getByTestId('login-page')).toBeVisible();
    await page.getByTestId('login-manager-email').fill('manager@acme.demo');
    await page.getByTestId('login-manager-password').fill('demo');
    await page.getByTestId('login-manager-password-submit').click();
    await expect(page).toHaveURL(/\/(home|console|triage)(\/|$|\?)/, { timeout: 20_000 });
    await expect(page.getByTestId('topbar')).toBeVisible();

    await page.goto('/triage');
    await expect(page.getByTestId('triage-page')).toBeVisible();
    await page.getByTestId('triage-filter-all').click();
    await expect(page.getByTestId('triage-card-MVP-A')).toBeVisible();
    await expect(page.getByTestId('triage-card-MVP-B')).toBeVisible();
    await expect(page.getByTestId('triage-card-MVP-C')).toBeVisible();

    await page.getByTestId('triage-ai-MVP-A').click();
    await expect(page.getByTestId('triage-action-error')).toHaveCount(0);
    await expect(page.getByTestId('triage-notice')).toBeVisible({ timeout: 45_000 });

    await page.goto('/projects/MVP/work/wi-mvp-a');
    await expect(page.getByTestId('task-detail-page')).toBeVisible();
    await expect(page.getByTestId('task-issue-key')).toHaveText('MVP-A');
    await expect(page.getByTestId('task-audit-trail')).toBeVisible();
  });

  test('PWA / mobile viewport: ticket list loads', async ({ page, request }) => {
    const seed = await request.post('/api/v1/demo/run');
    expect(seed.ok()).toBeTruthy();

    await page.setViewportSize({ width: 390, height: 844 });
    await clearBrowserSession(page);
    await page.goto('/login');
    await page.getByTestId('login-manager-email').fill('manager@acme.demo');
    await page.getByTestId('login-manager-password').fill('demo');
    await page.getByTestId('login-manager-password-submit').click();
    await expect(page.getByTestId('topbar')).toBeVisible({ timeout: 20_000 });

    await page.goto('/triage');
    await expect(page.getByTestId('triage-page')).toBeVisible();
    await page.getByTestId('triage-filter-all').click();
    await expect(page.getByTestId('triage-card-deck')).toBeVisible();
    await expect(page.getByTestId('triage-card-MVP-A')).toBeVisible();
  });
});
