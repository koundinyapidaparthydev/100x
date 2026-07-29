import { test, expect } from '@playwright/test';
import { clearBrowserSession, loginAs } from './helpers';

test.describe('Auth gate + session', () => {
  test('unauthenticated visit redirects to login', async ({ page }) => {
    await clearBrowserSession(page);
    await page.goto('/dashboard');
    await expect(page.getByTestId('login-page')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('manager login reaches dashboard and logout clears session', async ({ page }) => {
    await clearBrowserSession(page);
    await loginAs(page, 'manager');
    await expect(page.getByTestId('session-avatar')).toHaveAttribute('data-role', 'manager');

    await page.getByTestId('logout-button').click();
    await expect(page.getByTestId('login-page')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);

    await page.goto('/boards');
    await expect(page.getByTestId('login-page')).toBeVisible();
  });
});
