import { test, expect } from '@playwright/test';
import { clearBrowserSession, loginAs } from './helpers';

test.describe('Approvals & audit', () => {
  test.beforeEach(async ({ page }) => {
    await clearBrowserSession(page);
    await loginAs(page, 'manager');
  });

  test('approvals page lists pending items and can approve', async ({ page }) => {
    await page.goto('/approvals');
    await expect(page.getByTestId('approvals-page')).toBeVisible();
    await expect(page.getByTestId('approvals-pending-list')).toBeVisible();

    const approveBtn = page.locator('[data-testid^="approval-approve-"]').first();
    await expect(approveBtn).toBeVisible();
    const testId = await approveBtn.getAttribute('data-testid');
    const approvalId = testId!.replace('approval-approve-', '');

    await approveBtn.click();
    await expect(page.getByTestId(`approval-card-${approvalId}`)).toHaveCount(0);
    await expect(page.getByTestId('approvals-decided-list')).toBeVisible();
  });

  test('admin stays concise; notifications bell reaches approvals', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByTestId('admin-page')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Organization information' })).toBeVisible();
    await expect(page.getByTestId('admin-pending-approvals')).toHaveCount(0);

    await page.getByTestId('nav-notifications').click();
    await expect(page).toHaveURL(/\/approvals$/);
    await expect(page.getByTestId('approvals-page')).toBeVisible();
  });

  test('project approvals and activity retain project context', async ({ page }) => {
    const projectId = 'INFRA';
    const encodedProjectId = encodeURIComponent(projectId);

    await page.goto('/projects');
    await page.getByTestId('boards-connect-open').click();
    await page.getByTestId('boards-connect-project-id').fill(projectId);
    await page.getByTestId('boards-connect-name').fill('Infrastructure');
    await page.getByTestId('boards-connect-submit').click();
    await page.goto(`/projects/${encodedProjectId}/approvals`);
    await expect(page.getByTestId('approvals-page')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Project approvals' })).toBeVisible();
    await expect(page.getByTestId('nav-project-approvals')).toHaveAttribute('href', `/projects/${encodedProjectId}/approvals`);
    await expect(
      page.getByTestId('approvals-pending-list').or(page.getByTestId('approvals-decided-list')),
    ).toBeVisible();

    await page.getByTestId('nav-project-activity').click();
    await expect(page).toHaveURL(new RegExp(`/projects/${encodedProjectId}/activity$`));
    await expect(page.getByTestId('audit-log-page')).toHaveAttribute('data-project-id', projectId);
    await expect(page.getByRole('heading', { name: 'Activity' })).toBeVisible();
  });

  test('audit log shows seeded and new events', async ({ page }) => {
    await page.goto('/audit');
    await expect(page).toHaveURL(/\/audit$/);
    await expect(page.getByTestId('audit-log-page')).toBeVisible();
    await expect(page.getByTestId('audit-table')).toBeVisible();
    await expect(page.getByTestId('audit-table').locator('tbody tr').first()).toBeVisible();

    // Connect + sync a board to append a visible audit trail, then reload log.
    await page.goto('/projects');
    await page.getByTestId('boards-connect-open').click();
    await page.getByTestId('boards-connect-project-id').fill('APLIFYAI');
    await page.getByTestId('boards-connect-name').fill('AplifyAI Core');
    await page.getByTestId('boards-connect-submit').click();
    await page.goto('/projects');
    await page.getByTestId('board-sync-APLIFYAI').click();
    await page.goto('/audit');
    await expect(page.getByTestId('audit-table')).toBeVisible();
    await expect(page.locator('td').filter({ hasText: /board\.|sync|auth\.|job\./i }).first()).toBeVisible();
  });
});
