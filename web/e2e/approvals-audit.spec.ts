import { test, expect } from '@playwright/test';
import { clearBrowserSession, loginAs } from './helpers';

test.describe('Approvals & audit', () => {
  test.beforeEach(async ({ page }) => {
    await clearBrowserSession(page);
    await loginAs(page, 'manager');
  });

  test('approvals page lists pending items and can approve', async ({ page }) => {
    await page.getByTestId('nav-approvals').click();
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

  test('admin shows pending approvals; notifications bell reaches approvals', async ({ page }) => {
    await page.getByTestId('nav-admin').click();
    await expect(page.getByTestId('admin-page')).toBeVisible();
    await expect(page.getByTestId('admin-pending-approvals')).toBeVisible();

    await page.getByTestId('nav-notifications').click();
    await expect(page.getByTestId('approvals-page')).toBeVisible();
  });

  test('audit log shows seeded and new events', async ({ page }) => {
    await page.getByTestId('nav-audit-log').click();
    await expect(page.getByTestId('audit-log-page')).toBeVisible();
    await expect(page.getByTestId('audit-table')).toBeVisible();
    await expect(page.locator('[data-testid^="audit-row-"]').first()).toBeVisible();

    // Trigger a login-visible audit trail by syncing a board, then reload log.
    await page.getByTestId('nav-boards').click();
    await page.getByTestId('board-sync-APLIFYAI').click();
    await page.getByTestId('nav-audit-log').click();
    await expect(page.getByTestId('audit-table')).toBeVisible();
    await expect(page.locator('td').filter({ hasText: /board\.|sync|auth\.|job\./i }).first()).toBeVisible();
  });
});
