import { test, expect } from '@playwright/test';
import { clearBrowserSession, loginAs } from './helpers';

/** Connect GitHub via PAT modal (sandbox path — no real OAuth). */
async function connectGithubWithPat(page: import('@playwright/test').Page) {
  await page.getByTestId('connect-github').click();
  await expect(page.getByTestId('mcp-connect-panel')).toBeVisible();
  await page.getByTestId('mcp-connect-confirm').click();

  // token_required opens the PAT dialog when no credential is stored yet.
  const tokenPanel = page.getByTestId('mcp-token-panel');
  await expect(tokenPanel).toBeVisible({ timeout: 10_000 });
  await page.getByTestId('mcp-token-input').fill('ghp_e2e_env_scoped_token');
  await page.getByTestId('mcp-token-save').click();

  await expect(page.getByTestId('disconnect-github')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('connection-github').getByText(/Connected \(/)).toBeVisible();
}

async function switchEnvironment(page: import('@playwright/test').Page, key: 'prod' | 'stage') {
  // Topbar + drawer both render the switcher — prefer the header control.
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

test.describe('Env-scoped MCP connections', () => {
  test.beforeEach(async ({ page }) => {
    await clearBrowserSession(page);
    await loginAs(page, 'root');
  });

  test('GitHub connection is isolated across Prod ↔ Staging', async ({ page }) => {
    await page.goto('/connections');
    await expect(page.getByTestId('connections-page')).toBeVisible();
    await expect(page.getByTestId('connections-env-banner')).toBeVisible();

    // Ensure Production is active before connecting.
    await switchEnvironment(page, 'prod');
    await expect(page.getByTestId('connections-env-banner')).toContainText(/Production/i);

    // Fresh prod should not already show a live disconnect control.
    if (await page.getByTestId('disconnect-github').count()) {
      await page.getByTestId('disconnect-github').click();
      await expect(page.getByTestId('connect-github')).toBeVisible({ timeout: 10_000 });
    }

    await connectGithubWithPat(page);
    await expect(page.getByTestId('disconnect-github')).toBeVisible();

    // Staging has a separate connection list — GitHub should not be connected there.
    await switchEnvironment(page, 'stage');
    await expect(page.getByTestId('connections-env-banner')).toContainText(/Staging/i);
    await expect(page.getByTestId('connect-github')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('disconnect-github')).toHaveCount(0);

    // Switch back — Prod connection restored.
    await switchEnvironment(page, 'prod');
    await expect(page.getByTestId('connections-env-banner')).toContainText(/Production/i);
    await expect(page.getByTestId('disconnect-github')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('connection-github').getByText(/Connected \(/)).toBeVisible();
  });
});
