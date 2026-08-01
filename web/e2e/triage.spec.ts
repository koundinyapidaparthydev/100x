import { test, expect } from '@playwright/test';
import { clearBrowserSession, findUntreatedWorkItem, loginAs } from './helpers';

test.describe('Triage paths', () => {
  test.beforeEach(async ({ page }) => {
    await clearBrowserSession(page);
    await loginAs(page, 'manager');
  });

  test('AI-first triage from ticket detail', async ({ page, request }) => {
    const workItem = await findUntreatedWorkItem(request);
    await page.goto(
      `/projects/${encodeURIComponent(workItem.board.projectId)}/work/${encodeURIComponent(workItem.id)}`,
    );
    await expect(page.getByTestId('task-detail-page')).toBeVisible();

    await page.getByTestId('task-ai-first').click();
    await expect(page.getByTestId('task-action-error')).toHaveCount(0);
    await expect(page.getByTestId('task-triage-decision')).toContainText(/ai.?first/i, {
      timeout: 45_000,
    });
  });

  test('human-first triage from ticket detail', async ({ page, request }) => {
    const workItem = await findUntreatedWorkItem(request);
    await page.goto(
      `/projects/${encodeURIComponent(workItem.board.projectId)}/work/${encodeURIComponent(workItem.id)}`,
    );
    await expect(page.getByTestId('task-detail-page')).toBeVisible();

    await page.getByTestId('task-human-first').click();
    await expect(page.getByTestId('task-action-error')).toHaveCount(0);
    await expect(page.getByTestId('task-triage-decision')).toContainText(/human.?first/i, {
      timeout: 20_000,
    });
  });
});
