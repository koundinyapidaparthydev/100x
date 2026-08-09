import { test, expect } from '@playwright/test';
import { clearBrowserSession, loginAs } from './helpers';

const AVAILABLE_IDS = ['jira', 'slack', 'github', 'aws', 'gcp', 'azure', 'nvidia'] as const;

test.describe('Connections Available / Upcoming layout', () => {
  test.beforeEach(async ({ page }) => {
    await clearBrowserSession(page);
    await loginAs(page, 'root');
  });

  test('shows seven Available cards, progress copy, and Upcoming for non-live adds', async ({
    page,
  }) => {
    await page.goto('/connections');
    await expect(page.getByTestId('connections-page')).toBeVisible();
    await expect(page.getByTestId('connections-list')).toBeVisible();

    const progress = page.getByTestId('connections-progress');
    await expect(progress).toBeVisible();
    await expect(progress).toContainText(/available/i);

    for (const id of AVAILABLE_IDS) {
      await expect(page.getByTestId(`connection-${id}`)).toBeVisible();
      await expect(page.getByTestId(`secure-${id}`)).toBeVisible();
      // Connect or Disconnect depending on leftover env-scoped MCP state from prior tests.
      await expect(
        page.getByTestId(`connect-${id}`).or(page.getByTestId(`disconnect-${id}`)),
      ).toBeVisible();
    }

    // Non-live connectable providers (e.g. Datadog) land in Upcoming after Add.
    await page.getByTestId('connections-add').click();
    await expect(page.getByTestId('connections-add-panel')).toBeVisible();
    await page.getByTestId('connections-add-search').fill('Datadog');
    await page.getByTestId('add-service-datadog').click();

    await expect(page.getByTestId('connections-upcoming-grid')).toBeVisible();
    const upcomingDatadog = page
      .getByTestId('connections-upcoming-grid')
      .getByTestId('connection-datadog');
    await expect(upcomingDatadog).toBeVisible();
    await expect(upcomingDatadog).toContainText(/Upcoming/i);
    await expect(progress).toContainText(/upcoming/i);

    // Upcoming is Details-only — no Connect MCP primary action on the grid tile.
    await expect(
      page.getByTestId('connections-upcoming-grid').getByTestId('connect-datadog'),
    ).toHaveCount(0);

    await upcomingDatadog.click();
    await expect(page.getByTestId('secure-setup-panel')).toBeVisible();
  });

  test('Go to home CTA navigates to /home', async ({ page }) => {
    await page.goto('/connections');
    await expect(page.getByTestId('connections-page')).toBeVisible();
    await page.getByTestId('connections-to-projects').click();
    await expect(page).toHaveURL(/\/home$/, { timeout: 20_000 });
  });
});
