import { test, expect } from '@playwright/test';
import { clearBrowserSession, loginAs } from './helpers';

test.describe('Boards', () => {
  test.beforeEach(async ({ page }) => {
    await clearBrowserSession(page);
    await loginAs(page, 'manager');
  });

  test('lists seeded boards and can sync sandbox board', async ({ page }) => {
    await page.getByTestId('nav-boards').click();
    await expect(page.getByTestId('boards-page')).toBeVisible();
    await expect(page.getByTestId('board-card-APLIFYAI')).toBeVisible();
    await expect(page.getByTestId('board-card-INFRA')).toBeVisible();

    await page.getByTestId('board-sync-APLIFYAI').click();
    await expect(page.getByTestId('boards-action-error')).toHaveCount(0);
    await expect(page.getByTestId('board-card-APLIFYAI')).toBeVisible();
  });

  test('connect board modal creates a sandbox project', async ({ page }) => {
    await page.getByTestId('nav-boards').click();
    await page.getByTestId('boards-connect-open').click();
    await expect(page.getByTestId('boards-connect-modal')).toBeVisible();

    const projectId = `E2E${Date.now().toString().slice(-5)}`;
    await page.getByTestId('boards-connect-project-id').fill(projectId);
    await page.getByTestId('boards-connect-name').fill('E2E Sandbox Board');
    await page.getByTestId('boards-connect-submit').click();

    await expect(page.getByTestId('boards-connect-modal')).toHaveCount(0);
    await expect(page.getByTestId(`board-card-${projectId}`)).toBeVisible({ timeout: 20_000 });
  });
});
