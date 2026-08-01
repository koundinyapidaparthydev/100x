import { test, expect } from '@playwright/test';
import { clearBrowserSession, loginAs } from './helpers';

test.describe('RBAC negative paths', () => {
  test('engineer project mutations are not rendered in the workspace', async ({ page }) => {
    await clearBrowserSession(page);
    await loginAs(page, 'engineer');
    await expect(page.getByTestId('session-avatar')).toHaveAttribute('data-role', 'engineer');

    await page.getByTestId('nav-projects').click();
    await expect(page.getByTestId('boards-page')).toBeVisible();

    await expect(page.getByTestId('boards-connect-open')).toHaveCount(0);
    await expect(page.locator('[data-testid^="board-sync-"]')).toHaveCount(0);
    await expect(page.getByText(/can review work, but cannot connect or sync projects/i)).toBeVisible();

    await page.getByRole('link', { name: 'Open workspace' }).first().click();
    await expect(page.getByTestId('dashboard-heading')).toBeVisible();
    await expect(page.locator('[data-testid^="board-sync-"]')).toHaveCount(0);
    await page.getByTestId('nav-project-work').click();
    await expect(page.getByTestId('project-work-page')).toBeVisible();
  });

  test('engineer policy controls are read-only', async ({ page }) => {
    await clearBrowserSession(page);
    await loginAs(page, 'engineer');

    await page.getByTestId('nav-governance').click();
    await expect(page).toHaveURL(/\/governance\/defaults$/);
    await expect(page.getByTestId('policies-page')).toBeVisible();
    await expect(page.getByTestId('policy-security-level')).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Save changes' })).toHaveCount(0);
    await expect(page.getByText(/can review policy defaults but cannot change them/i)).toBeVisible();
  });
});
