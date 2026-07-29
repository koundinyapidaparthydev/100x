import { test, expect } from '@playwright/test';
import { clearBrowserSession, loginAs } from './helpers';

test.describe('RBAC negative paths', () => {
  test('engineer cannot mutate boards (403 UX)', async ({ page }) => {
    await clearBrowserSession(page);
    await loginAs(page, 'engineer');
    await expect(page.getByTestId('session-avatar')).toHaveAttribute('data-role', 'engineer');

    await page.getByTestId('nav-boards').click();
    await expect(page.getByTestId('boards-page')).toBeVisible();

    await page.getByTestId('boards-connect-open').click();
    await page.getByTestId('boards-connect-project-id').fill('FORBIDDEN');
    await page.getByTestId('boards-connect-name').fill('Should Fail');
    await page.getByTestId('boards-connect-submit').click();

    const error = page.getByTestId('boards-action-error');
    await expect(error).toContainText(/requires role|403|forbidden|founder|manager/i);
  });

  test('engineer cannot mutate policies (403 UX)', async ({ page }) => {
    await clearBrowserSession(page);
    await loginAs(page, 'engineer');

    await page.getByTestId('nav-policies').click();
    await expect(page.getByTestId('policies-page')).toBeVisible();
    await page.getByTestId('policy-edit-toggle').click();
    await page.getByTestId('policy-security-level').selectOption('enterprise');
    await page.getByTestId('policy-save').click();

    await expect(page.getByTestId('policy-save-message')).toBeVisible();
    await expect(page.getByTestId('policy-save-message')).toContainText(/requires role|403|forbidden|founder|manager/i);
  });
});
