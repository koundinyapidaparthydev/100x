import { test, expect } from '@playwright/test';
import { clearBrowserSession, findUntreatedWorkItem, loginAs } from './helpers';

test.describe('Project workspace', () => {
  test.beforeEach(async ({ page }) => {
    await clearBrowserSession(page);
    await loginAs(page, 'manager');
  });

  test('can connect a project and sync it', async ({ page }) => {
    await page.getByTestId('nav-projects').click();
    await expect(page).toHaveURL(/\/projects$/);
    await expect(page.getByTestId('boards-page')).toBeVisible();

    await page.getByTestId('boards-connect-open').click();
    await expect(page.getByTestId('boards-connect-modal')).toBeVisible();
    const projectId = `SYNC${Date.now().toString().slice(-5)}`;
    await page.getByTestId('boards-connect-project-id').fill(projectId);
    await page.getByTestId('boards-connect-name').fill('Sync Probe');
    await page.getByTestId('boards-connect-submit').click();
    await expect(page).toHaveURL(new RegExp(`/projects/${projectId}$`), { timeout: 20_000 });

    await page.getByTestId('nav-projects').click();
    await expect(page.getByTestId(`board-card-${projectId}`)).toBeVisible();
    await page.getByTestId(`board-sync-${projectId}`).click();
    await expect(page.getByTestId('boards-action-error')).toHaveCount(0);
  });

  test('connect board modal creates a sandbox project', async ({ page }) => {
    await page.getByTestId('nav-projects').click();
    await page.getByTestId('boards-connect-open').click();
    await expect(page.getByTestId('boards-connect-modal')).toBeVisible();

    const projectId = `E2E${Date.now().toString().slice(-5)}`;
    await page.getByTestId('boards-connect-project-id').fill(projectId);
    await page.getByTestId('boards-connect-name').fill('E2E Sandbox Board');
    await page.getByTestId('boards-connect-submit').click();

    await expect(page.getByTestId('boards-connect-modal')).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`/projects/${projectId}$`), { timeout: 20_000 });
    await expect(page.getByTestId('dashboard-heading')).toHaveText('E2E Sandbox Board');
  });

  test('project navigation supports deep links and preserves work filters', async ({ page, request }) => {
    const workItem = await findUntreatedWorkItem(request);
    const projectId = encodeURIComponent(workItem.board.projectId);

    // Ensure the seeded project key is connected so overview/work routes resolve.
    await page.getByTestId('nav-projects').click();
    await page.getByTestId('boards-connect-open').click();
    await page.getByTestId('boards-connect-project-id').fill(workItem.board.projectId);
    await page.getByTestId('boards-connect-name').fill(`Seed ${workItem.board.projectId}`);
    await page.getByTestId('boards-connect-submit').click();
    // May already exist from a prior connect in this worker — either land on project or stay with error.
    await page.goto(`/projects/${projectId}`);
    await expect(page.getByTestId('dashboard-heading')).toBeVisible();
    await expect(page.getByTestId('attention-queue')).toBeVisible();
    await expect(page.getByTestId('nav-project-overview')).toHaveAttribute('href', `/projects/${projectId}`);

    await page.getByTestId('nav-project-work').click();
    await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/work$`));
    await page.getByTestId('work-filter-all').click();
    await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/work\\?filter=all$`));

    await page.getByTestId(`work-item-link-${workItem.id}`).click();
    await expect(page).toHaveURL(
      new RegExp(`/projects/${projectId}/work/${encodeURIComponent(workItem.id)}\\?filter=all$`),
    );
    await expect(page.getByTestId('task-detail-page')).toBeVisible();
    await expect(page.getByTestId('task-issue-key')).toHaveText(workItem.board.issueKey);

    await page.getByTestId('work-item-return').click();
    await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/work\\?filter=all$`));
    await expect(page.getByTestId('work-filter-all')).toHaveAttribute('aria-selected', 'true');
  });
});
