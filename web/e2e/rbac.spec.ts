import { test, expect } from '@playwright/test';
import { clearBrowserSession, injectCompletedOnboarding, injectSession, loginAs } from './helpers';

test.describe('RBAC negative paths', () => {
  test('member project mutations are not rendered in the workspace', async ({ page, request }) => {
    await clearBrowserSession(page);
    await injectCompletedOnboarding(page);
    await injectSession(page, request, 'engineer');
    await page.goto('/projects');

    await expect(page.getByTestId('session-avatar')).toHaveAttribute('data-role', 'member');

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

  test('member policy controls are read-only', async ({ page, request }) => {
    await clearBrowserSession(page);
    await injectCompletedOnboarding(page);
    await injectSession(page, request, 'engineer');
    await page.goto('/governance/defaults');
    await expect(page).toHaveURL(/\/governance\/defaults$/);
    await expect(page.getByTestId('policies-page')).toBeVisible();
    await expect(page.getByTestId('policy-security-level')).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Save changes' })).toHaveCount(0);
    await expect(page.getByText(/can review policy defaults but cannot change them/i)).toBeVisible();
  });

  test('owner can open Roles and create a custom role', async ({ page }) => {
    await clearBrowserSession(page);
    await loginAs(page, 'root');
    await page.goto('/console/roles');
    await expect(page.getByTestId('console-roles-page')).toBeVisible();
    await expect(page.getByTestId('console-roles-empty')).toBeVisible();
    await page.getByTestId('console-roles-empty-create').click();
    await expect(page.getByTestId('console-role-create-form')).toBeVisible();
    await page.getByTestId('console-role-name').fill('Iterator');
    await page.getByTestId('console-role-cap-work_items.triage').click();
    await page.getByTestId('console-role-mcp-jira').selectOption('read');
    await page.getByTestId('console-role-create-submit').click();
    await expect(page.getByText('Iterator')).toBeVisible();
  });
});
