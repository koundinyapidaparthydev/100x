import { test, expect } from '@playwright/test';
import { clearBrowserSession, loginAs } from './helpers';

test.describe('Policies & PII', () => {
  test.beforeEach(async ({ page }) => {
    await clearBrowserSession(page);
    await loginAs(page, 'manager');
  });

  test('policy edit persists security level', async ({ page }) => {
    await page.getByTestId('nav-policies').click();
    await expect(page.getByTestId('policies-page')).toBeVisible();

    await page.getByTestId('policy-edit-toggle').click();
    await expect(page.getByTestId('policy-edit-form')).toBeVisible();

    const select = page.getByTestId('policy-security-level');
    const current = await select.inputValue();
    const next = current === 'elevated' ? 'enterprise' : 'elevated';
    await select.selectOption(next);

    const patch = page.waitForResponse(
      (r) => r.url().includes('/api/v1/policies/') && r.request().method() === 'PATCH' && r.ok(),
    );
    await page.getByTestId('policy-save').click();
    await patch;

    await page.reload();
    await expect(page.getByTestId('policies-page')).toBeVisible();
    await page.getByTestId('policy-edit-toggle').click();
    await expect(page.getByTestId('policy-security-level')).toHaveValue(next);
  });

  test('PII rules page loads and save persists mode change', async ({ page }) => {
    await page.getByTestId('nav-pii-rules').click();
    await expect(page.getByTestId('pii-rules-page')).toBeVisible();

    const emailMode = page.getByTestId('pii-mode-email');
    const current = await emailMode.inputValue();
    const next = current === 'hash' ? 'redact' : 'hash';
    await emailMode.selectOption(next);

    const patch = page.waitForResponse(
      (r) => r.url().includes('/api/v1/policies/') && r.request().method() === 'PATCH' && r.ok(),
    );
    await page.getByTestId('pii-save').click();
    await patch;

    await page.reload();
    await expect(page.getByTestId('pii-mode-email')).toHaveValue(next);
  });
});
