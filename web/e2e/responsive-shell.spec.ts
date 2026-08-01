import { expect, test, type Page } from '@playwright/test';
import { clearBrowserSession, loginAs } from './helpers';

/** Tailwind `md` breakpoint — desktop topbar owns nav-* IDs at ≥768. */
const DESKTOP_MIN = 768;

async function expectTopbarOwnsNav(page: Page) {
  await expect(page.locator('[data-testid="topbar"] [data-testid="nav-projects"]')).toBeVisible();
  await expect(page.locator('[data-testid="topbar"] [data-testid="nav-approvals"]')).toBeVisible();
  await expect(page.locator('[data-testid="topbar"] [data-testid="nav-governance"]')).toBeVisible();
  await expect(page.locator('[data-testid="topbar"] [data-testid="nav-audit"]')).toBeVisible();
  await expect(page.locator('[data-testid="topbar"] [data-testid="nav-admin"]')).toBeVisible();
  await expect(page.getByTestId('nav-notifications')).toBeVisible();
  await expect(page.locator('[data-testid="sidebar-navigation"] [data-testid="nav-projects"]')).toHaveCount(0);
}

async function expectDrawerOwnsNav(page: Page) {
  await expect(page.locator('[data-testid="topbar"] [data-testid="nav-projects"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="topbar"] [data-testid="nav-admin"]')).toHaveCount(0);
  // Notifications bell stays in the top chrome on all viewports.
  await expect(page.getByTestId('nav-notifications')).toBeVisible();

  const drawer = page.getByTestId('sidebar-navigation');
  await expect(drawer).toBeHidden();
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(drawer).toBeVisible();
  await expect(drawer.getByTestId('nav-projects')).toBeVisible();
  await expect(drawer.getByTestId('nav-approvals')).toBeVisible();
  await expect(drawer.getByTestId('nav-governance')).toBeVisible();
  await expect(drawer.getByTestId('nav-audit')).toBeVisible();
  // Admin sits in the drawer footer, outside sidebar-navigation.
  await expect(page.getByTestId('nav-admin')).toBeVisible();
  await page.getByRole('button', { name: 'Close navigation' }).last().click();
  await expect(drawer).toBeHidden();
}

test.describe('Responsive shell', () => {
  test.describe('mobile drawer chrome', () => {
    test.use({ viewport: { width: 360, height: 800 } });

    test('360px navigation, headers, and project pages do not overflow', async ({ page, request }) => {
      await clearBrowserSession(page);
      await loginAs(page, 'manager');

      await expect(page.getByTestId('topbar')).toBeVisible();
      await expectDrawerOwnsNav(page);

      const workItemsResponse = await request.get('/api/v1/work-items');
      expect(workItemsResponse.ok()).toBeTruthy();
      const workItems = (await workItemsResponse.json()) as Array<{ id: string; board: { projectId: string } }>;
      const workItem = workItems[0]!;
      const projectId = encodeURIComponent(workItem.board.projectId);
      const paths = [
        '/projects',
        `/projects/${projectId}`,
        `/projects/${projectId}/work?filter=all`,
        `/projects/${projectId}/work/${encodeURIComponent(workItem.id)}?filter=all`,
        `/projects/${projectId}/approvals`,
        `/projects/${projectId}/activity`,
        '/approvals',
        '/governance/defaults',
        '/governance/pii',
        '/governance/runtime#models',
        '/audit',
        '/admin',
      ];

      for (const path of paths) {
        await page.goto(path);
        await expect(page.getByTestId('topbar')).toBeVisible();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, `${path} should not overflow horizontally`).toBeLessThanOrEqual(1);
      }

      await page.goto(`/projects/${projectId}`);
      await expect(page.getByTestId('project-context-row')).toBeVisible();
      await expect(page.locator('[data-testid="project-context-row"] [data-testid="nav-project-overview"]')).toHaveCount(0);

      await page.getByRole('button', { name: 'Open navigation' }).click();
      const drawer = page.getByTestId('sidebar-navigation');
      await expect(drawer.getByTestId('nav-project-overview')).toBeVisible();
      await expect(drawer.getByTestId('nav-project-work')).toBeVisible();
      await expect(drawer.getByTestId('nav-project-approvals')).toBeVisible();
      await expect(drawer.getByTestId('nav-project-activity')).toBeVisible();
      await page.getByRole('button', { name: 'Close navigation' }).last().click();

      await page.goto('/projects');
      const headingBox = await page.getByRole('heading', { name: 'Projects' }).boundingBox();
      const actionBox = await page.getByTestId('boards-connect-open').boundingBox();
      expect(headingBox).not.toBeNull();
      expect(actionBox).not.toBeNull();
      expect(headingBox!.x + headingBox!.width).toBeLessThanOrEqual(360);
      expect(actionBox!.y).toBeGreaterThan(headingBox!.y + headingBox!.height);
    });
  });

  test.describe('desktop top-nav chrome', () => {
    test.use({ viewport: { width: DESKTOP_MIN, height: 800 } });

    test('desktop topbar owns nav IDs; drawer stays collapsed', async ({ page }) => {
      await clearBrowserSession(page);
      await loginAs(page, 'manager');

      await expect(page.getByTestId('topbar')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Open navigation' })).toBeHidden();
      await expect(page.getByTestId('sidebar-navigation')).toBeHidden();
      await expectTopbarOwnsNav(page);

      await page.goto('/projects/INFRA');
      await expect(page.getByTestId('project-context-row')).toBeVisible();
      await expect(page.locator('[data-testid="project-context-row"] [data-testid="nav-project-overview"]')).toBeVisible();
      await expect(page.locator('[data-testid="project-context-row"] [data-testid="nav-project-work"]')).toBeVisible();
      await expect(page.locator('[data-testid="project-context-row"] [data-testid="nav-project-approvals"]')).toBeVisible();
      await expect(page.locator('[data-testid="project-context-row"] [data-testid="nav-project-activity"]')).toBeVisible();
      await expect(page.locator('[data-testid="sidebar-navigation"] [data-testid="nav-project-work"]')).toHaveCount(0);
    });
  });
});
