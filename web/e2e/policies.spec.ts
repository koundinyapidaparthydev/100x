import { test, expect } from '@playwright/test';
import { clearBrowserSession, loginAs } from './helpers';

async function switchEnvironment(page: import('@playwright/test').Page, key: 'prod' | 'stage') {
  const trigger = page.getByTestId('topbar').getByTestId('environment-switcher-trigger');
  const want = key === 'prod' ? /Production/i : /Staging/i;
  const current = (await trigger.getAttribute('aria-label')) ?? '';
  if (want.test(current)) return;

  await trigger.click();
  const menu = page.getByTestId('topbar').getByTestId('environment-switcher-menu');
  await expect(menu).toBeVisible();
  await menu.getByTestId(`environment-option-${key}`).click();
  await expect(trigger).toHaveAttribute('aria-label', want);
}

test.describe('Policies & PII', () => {
  test.beforeEach(async ({ page }) => {
    await clearBrowserSession(page);
    await loginAs(page, 'root');
  });

  test('policy defaults persist a security-level change', async ({ page }) => {
    await page.goto('/governance/defaults');
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
    await page.goto('/governance/defaults');
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

  test('PII mode change on Staging does not affect Production', async ({ page }) => {
    await page.goto('/governance/pii');
    await expect(page.getByTestId('pii-rules-page')).toBeVisible();

    await switchEnvironment(page, 'prod');
    await expect(page.getByTestId('pii-active-env')).toContainText(/Production/i);
    const prodMode = await page.getByTestId('pii-mode-email').inputValue();

    await switchEnvironment(page, 'stage');
    await expect(page.getByTestId('pii-active-env')).toContainText(/Staging/i);
    const stageSelect = page.getByTestId('pii-mode-email');
    const stageCurrent = await stageSelect.inputValue();
    const stageNext = stageCurrent === 'hash' ? 'redact' : 'hash';
    await stageSelect.selectOption(stageNext);
    if (stageNext === 'redact') {
      await page.getByTestId('pii-style-email').selectOption('fixed');
      await page.getByTestId('pii-fixed-email').fill('stage-cleared@example.invalid');
    }

    const patch = page.waitForResponse(
      (r) => r.url().includes('/api/v1/policies/') && r.request().method() === 'PATCH' && r.ok(),
    );
    await page.getByRole('button', { name: 'Save changes' }).click();
    await patch;

    await switchEnvironment(page, 'prod');
    await expect(page.getByTestId('pii-active-env')).toContainText(/Production/i);
    await expect(page.getByTestId('pii-mode-email')).toHaveValue(prodMode);

    await switchEnvironment(page, 'stage');
    await expect(page.getByTestId('pii-mode-email')).toHaveValue(stageNext);
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
