import { expect, test, type Page } from '@playwright/test';
import { clearBrowserSession, DEMO_SESSION_KEY } from './helpers';

/** Add a service if it is not already selected (preselects use the same test ids on chips). */
async function pickService(page: Page, category: string, id: string, query: string) {
  const search = page.getByTestId(`service-search-${category}`);
  await search.click();
  await search.fill(query);
  const option = page.getByRole('listbox').getByTestId(`service-${id}`);
  if ((await option.count()) > 0) {
    await option.click();
  } else {
    await page.keyboard.press('Escape');
  }
}

async function fillFreeAnswers(page: Page) {
  await page.getByTestId('lite-intent').getByRole('button', { name: /Triage work faster/i }).click();
  await page.getByTestId('lite-team-size').getByRole('button', { name: /6–20 people/ }).click();
  await page.getByTestId('lite-pains').getByRole('button', { name: /Backlog is drowning us/i }).click();
}

async function fillEnterpriseMove(page: Page) {
  await page.getByTestId('ent-goals').getByRole('button', { name: /One triage surface/i }).click();
  await page.getByTestId('ent-buyer-role').getByRole('button', { name: /Delivery lead/i }).click();
  await page.getByTestId('ent-org-size').getByRole('button', { name: /21–100 people/ }).click();
  await page.getByTestId('ent-compliance').getByRole('button', { name: /^SOC2$/ }).click();
  await page.getByTestId('ent-timeline').getByRole('button', { name: /This quarter/i }).click();
}

async function fillExpectations(page: Page) {
  await page.getByTestId('speed-meter-40').click();
  await page.getByTestId('ent-improve').getByRole('button', { name: /Cycle time/i }).click();
  await page.getByTestId('ent-hitl').getByRole('button', { name: /High-risk only/i }).click();
}

async function fillRuntime(page: Page) {
  await page
    .getByTestId('runtime-hosting')
    .getByRole('button', { name: /Connected cloud accounts/i })
    .click();
  await expect(page.getByTestId('runtime-cloud-provider')).toBeVisible();
  await page.getByTestId('runtime-mode').getByRole('button').first().click();
  await page.getByTestId('runtime-custom-model').getByRole('button').first().click();
  await page.getByTestId('runtime-code-override').getByRole('button').first().click();
  await page.getByTestId('runtime-token-budget').getByRole('button').first().click();
  await page.getByTestId('runtime-mcp-allowlist').getByRole('button').first().click();
  await page.getByTestId('runtime-regions').getByRole('button', { name: /US East/i }).click();
}

test.describe('Onboarding wizard', () => {
  test.beforeEach(async ({ page }) => {
    await clearBrowserSession(page);
  });

  test('Free lite path: signup → answers + stack → connections → projects', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.getByTestId('signup-page')).toBeVisible();
    await page.getByTestId('signup-continue-demo').click();
    await expect(page).toHaveURL(/\/onboarding$/, { timeout: 20_000 });
    await expect(page.getByTestId('onboarding-plan-picker')).toBeVisible();

    await page.getByTestId('onboarding-plan-free').click();
    await expect(page.getByTestId('onboarding-slide')).toBeVisible();
    await expect(page.getByTestId('onboarding-continue')).toBeDisabled();
    await fillFreeAnswers(page);
    await expect(page.getByTestId('onboarding-continue')).toBeEnabled();
    await page.getByTestId('onboarding-continue').click();

    await expect(page.getByTestId('service-picker')).toBeVisible();
    await expect(page.getByTestId('onboarding-continue')).toBeDisabled();
    await pickService(page, 'boards', 'jira', 'Jira');
    await pickService(page, 'boards', 'smartsheet', 'Smart');
    await pickService(page, 'conversation', 'slack', 'Slack');
    await pickService(page, 'code', 'github', 'GitHub');
    await expect(page.getByTestId('onboarding-continue')).toBeEnabled();
    await page.getByTestId('onboarding-continue').click();

    await expect(page).toHaveURL(/\/connections$/, { timeout: 20_000 });
    await expect(page.getByTestId('connections-page')).toBeVisible();
    await expect(page.getByTestId('connection-jira')).toBeVisible();
    await expect(page.getByTestId('connection-smartsheet')).toBeVisible();
    await expect(page.getByTestId('connection-slack')).toBeVisible();
    await expect(page.getByTestId('connection-github')).toBeVisible();

    await page.getByTestId('connections-to-projects').click();
    await expect(page).toHaveURL(/\/projects$/, { timeout: 20_000 });
  });

  test('Enterprise full path reaches runtime slide and connections', async ({ page }) => {
    await page.goto('/signup');
    await page.getByTestId('signup-continue-demo').click();
    await expect(page).toHaveURL(/\/onboarding$/, { timeout: 20_000 });
    await page.getByTestId('onboarding-plan-enterprise').click();

    await expect(page.getByTestId('onboarding-continue')).toBeDisabled();
    await fillEnterpriseMove(page);
    await page.getByTestId('onboarding-continue').click();

    await expect(page.getByTestId('service-picker')).toBeVisible();
    await pickService(page, 'boards', 'jira', 'Jira');
    await pickService(page, 'cloud', 'aws', 'AWS');
    await page.getByTestId('onboarding-continue').click();

    await expect(page.getByTestId('speed-meter')).toBeVisible();
    await expect(page.getByTestId('onboarding-continue')).toBeDisabled();
    await fillExpectations(page);
    await page.getByTestId('onboarding-continue').click();

    await expect(page.getByTestId('runtime-slide')).toBeVisible();
    await expect(page.getByTestId('onboarding-continue')).toBeDisabled();
    await fillRuntime(page);
    await page.getByTestId('onboarding-continue').click();

    await expect(page).toHaveURL(/\/connections$/, { timeout: 20_000 });
    await expect(page.getByTestId('connection-jira')).toBeVisible();
    await expect(page.getByTestId('connection-aws')).toBeVisible();

    await page.getByTestId('connect-jira').click();
    await expect(page.getByTestId('mcp-connect-panel')).toBeVisible();
    await page.getByTestId('mcp-connect-confirm').click();
    await expect(page.getByTestId('connection-jira').getByText('Connected', { exact: true })).toBeVisible({
      timeout: 10_000,
    });

    await page.getByTestId('secure-aws').click();
    await expect(page.getByTestId('secure-setup-panel')).toBeVisible();
  });

  test('Team member sign-in requires onboarding before projects', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByTestId('login-page')).toBeVisible();
    await page.getByTestId('login-toggle-seats').click();
    await page.getByTestId('login-mode-member').click();
    await page.getByTestId('login-member-manager').click();
    await page.getByTestId('login-manager').click();
    await expect(page).toHaveURL(/\/onboarding$/, { timeout: 20_000 });
    await expect(page.getByTestId('onboarding-plan-picker')).toBeVisible();
    const session = await page.evaluate((key) => localStorage.getItem(key), DEMO_SESSION_KEY);
    expect(session).toBeTruthy();
  });
});
