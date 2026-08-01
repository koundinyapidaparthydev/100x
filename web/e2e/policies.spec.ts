import { test, expect } from '@playwright/test';
import { clearBrowserSession, loginAs } from './helpers';

test.describe('Policies & PII', () => {
  test.beforeEach(async ({ page }) => {
    await clearBrowserSession(page);
    await loginAs(page, 'manager');
  });

  test('policy defaults persist a security-level change', async ({ page }) => {
    await page.getByTestId('nav-governance').click();
    await expect(page).toHaveURL(/\/governance\/defaults$/);
    await expect(page.getByTestId('policies-page')).toBeVisible();
    await expect(page.getByTestId('policy-edit-form')).toBeVisible();

    const select = page.getByTestId('policy-security-level');
    const current = await select.inputValue();
    const next = current === 'elevated' ? 'enterprise' : 'elevated';
    await select.selectOption(next);

    const patch = page.waitForResponse(
      (r) => r.url().includes('/api/v1/policies/') && r.request().method() === 'PATCH' && r.ok(),
    );
    await page.getByRole('button', { name: 'Save changes' }).click();
    await patch;

    await page.reload();
    await expect(page.getByTestId('policies-page')).toBeVisible();
    await expect(page.getByTestId('policy-security-level')).toHaveValue(next);
  });

  test('PII rules page loads and save persists mode change', async ({ page }) => {
    await page.getByTestId('nav-governance').click();
    await page.getByRole('link', { name: 'PII & PCI' }).click();
    await expect(page).toHaveURL(/\/governance\/pii$/);
    await expect(page.getByTestId('pii-rules-page')).toBeVisible();

    const emailMode = page.getByTestId('pii-mode-email');
    const current = await emailMode.inputValue();
    const next = current === 'hash' ? 'redact' : 'hash';
    await emailMode.selectOption(next);

    if (next === 'redact') {
      await expect(page.getByTestId('pii-style-email')).toBeVisible();
      await page.getByTestId('pii-style-email').selectOption('fixed');
      await page.getByTestId('pii-fixed-email').fill('cleared@example.invalid');
    }

    const patch = page.waitForResponse(
      (r) => r.url().includes('/api/v1/policies/') && r.request().method() === 'PATCH' && r.ok(),
    );
    await page.getByRole('button', { name: 'Save changes' }).click();
    await patch;

    await page.reload();
    await expect(page.getByTestId('pii-mode-email')).toHaveValue(next);
  });

  test('governance runtime sections use consolidated routes', async ({ page }) => {
    await page.goto('/governance/runtime#models');
    await expect(page).toHaveURL(/\/governance\/runtime#models$/);
    await expect(page.getByRole('heading', { name: 'Model runtime' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Model runtime' })).toHaveAttribute('aria-current', 'page');

    await page.getByRole('link', { name: 'Cloud runtime' }).click();
    await expect(page).toHaveURL(/\/governance\/runtime#cloud$/);
    await expect(page.getByRole('heading', { name: 'Cloud runtime' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Cloud runtime' })).toHaveAttribute('aria-current', 'page');
  });
});
