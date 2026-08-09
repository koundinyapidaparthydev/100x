import { expect, test, type Page } from '@playwright/test';
import { clearBrowserSession, loginAs } from './helpers';

/** Tailwind `md` breakpoint — desktop chrome at ≥768. */
const DESKTOP_MIN = 768;

async function expectDesktopChrome(page: Page) {
  await expect(page.locator('[data-testid="topbar"] [data-testid="environment-switcher"]')).toBeVisible();
  await expect(page.locator('[data-testid="topbar"] [data-testid="nav-admin"]')).toBeVisible();
  await expect(page.getByTestId('nav-notifications')).toBeVisible();
  // Org links live in the desktop left rail (not the topbar).
  await expect(page.locator('[data-testid="topbar"] [data-testid="nav-projects"]')).toHaveCount(0);
  await expect(page.getByTestId('desktop-sidebar')).toBeVisible();
  await expect(page.getByTestId('sidebar-navigation').getByTestId('nav-projects')).toBeVisible();
  await expect(page.getByTestId('sidebar-navigation').getByTestId('nav-triage')).toBeVisible();
  await expect(page.getByTestId('sidebar-navigation').getByTestId('nav-console')).toBeVisible();
  // Console horizontal strip removed from topbar on desktop.
  await expect(page.getByTestId('console-context-row')).toHaveCount(0);
}

async function expectDrawerOwnsNav(page: Page) {
  await expect(page.locator('[data-testid="topbar"] [data-testid="nav-projects"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="topbar"] [data-testid="nav-admin"]')).toHaveCount(0);
  // Header switcher stays in the DOM but is CSS-hidden below `md`.
  await expect(page.locator('[data-testid="topbar"] [data-testid="environment-switcher"]')).toBeHidden();
  // Notifications bell stays in the top chrome on all viewports.
  await expect(page.getByTestId('nav-notifications')).toBeVisible();
  await expect(page.getByTestId('desktop-sidebar')).toHaveCount(0);

  const drawer = page.getByTestId('sidebar-navigation');
  await expect(drawer).toBeHidden();
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(drawer).toBeVisible();
  // Drawer env switcher sits above the scrollable nav list (sibling of sidebar-navigation).
  await expect(page.getByLabel('Primary navigation').getByTestId('environment-switcher')).toBeVisible();
  await expect(drawer.getByTestId('nav-projects')).toBeVisible();
  await expect(drawer.getByTestId('nav-triage')).toBeVisible();
  await expect(drawer.getByTestId('nav-approvals')).toBeVisible();
  await expect(drawer.getByTestId('nav-governance')).toBeVisible();
  await expect(drawer.getByTestId('nav-audit')).toBeVisible();
  await expect(drawer.getByTestId('nav-console')).toBeVisible();
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
        '/triage',
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

  test.describe('desktop left-rail chrome', () => {
    test.use({ viewport: { width: DESKTOP_MIN, height: 800 } });

    test('desktop left rail owns org + Console; topbar keeps env switcher', async ({ page }) => {
      await clearBrowserSession(page);
      await loginAs(page, 'manager');

      await expect(page.getByTestId('topbar')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Open navigation' })).toBeHidden();
      await expectDesktopChrome(page);

      // Console group expands with section links in the rail.
      await page.goto('/console');
      await expect(page.getByTestId('console-nav-group')).toBeVisible();
      await expect(page.getByTestId('console-nav-overview')).toBeVisible();
      await expect(page.getByTestId('console-nav-users')).toBeVisible();
      await expect(page.getByTestId('console-context-row')).toHaveCount(0);

      await page.goto('/projects/INFRA');
      await expect(page.getByTestId('project-context-row')).toBeVisible();
      await expect(page.locator('[data-testid="project-context-row"] [data-testid="nav-project-overview"]')).toBeVisible();
      await expect(page.locator('[data-testid="project-context-row"] [data-testid="nav-project-work"]')).toBeVisible();
      // Project links stay in the top context row on desktop (not duplicated in the rail).
      await expect(page.getByTestId('sidebar-navigation').getByTestId('nav-project-work')).toHaveCount(0);
    });
  });
});
