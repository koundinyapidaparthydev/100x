/* global by, device, element, expect */

const LONG_TIMEOUT = 30000;

async function waitForVisible(matcher, timeout = LONG_TIMEOUT) {
  await waitFor(element(matcher)).toBeVisible().withTimeout(timeout);
}

describe('AplifyAI manager journey', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true, delete: true });
  });

  it('enforces the auth gate and logs in', async () => {
    await device.openURL({ url: 'aplifyai://ticket/wi-aplifyai-101' });
    await waitForVisible(by.id('login-primary-button'));

    await element(by.id('login-primary-button')).tap();
    await waitForVisible(by.id('triage-ai-button'));
    await expect(element(by.text('APLIFYAI-101'))).toBeVisible();
  });

  it('navigates every manager tab', async () => {
    await element(by.id('tab-jobs')).tap();
    await waitForVisible(by.text('AI work that is queued, blocked, or ready for review.'));

    await element(by.id('tab-approvals')).tap();
    await waitForVisible(by.text('Review exception requests. Decisions are recorded but do not enact the requested exception.'));

    await element(by.id('tab-pii')).tap();
    await waitForVisible(by.text('Sensitive data'));

    await element(by.id('tab-triage')).tap();
    await waitForVisible(by.id('triage-ai-button'));
  });

  it('opens ticket details from triage', async () => {
    await element(by.id('triage-open-ticket-button')).tap();
    await waitForVisible(by.id('ticket-detail-screen'));
    await expect(element(by.text('Refactor authentication middleware'))).toBeVisible();

    await element(by.label('Back')).tap();
    await waitForVisible(by.id('triage-human-button'));
  });

  it('triages a ticket human-first with the button fallback', async () => {
    await element(by.id('triage-human-button')).tap();
    await waitForVisible(by.text('APLIFYAI-103'));
  });

  it('triages a ticket AI-first and navigates to its details', async () => {
    await element(by.id('triage-ai-button')).tap();
    await waitForVisible(by.id('ticket-detail-screen'));
    await expect(element(by.text('Add retry logic to webhook delivery'))).toBeVisible();

    await element(by.label('Back')).tap();
    await waitForVisible(by.text('INFRA-221'));
  });

  it('approves a reachable pending approval', async () => {
    await element(by.id('tab-approvals')).tap();
    await waitForVisible(by.id('approval-approve-app-infra-221'));
    await element(by.id('approval-approve-app-infra-221')).tap();
    await waitForVisible(by.text('approved'));
  });

  it('requests PII access through a blocked ticket', async () => {
    await element(by.id('tab-triage')).tap();
    await waitForVisible(by.text('INFRA-221'));
    await element(by.id('triage-ai-button')).tap();

    await waitForVisible(by.text('Blocked before model execution. Review the PII firewall.'));
    await element(by.text('Blocked before model execution. Review the PII firewall.')).tap();
    await waitForVisible(by.id('pii-request-access-button'));
    await element(by.id('pii-request-access-button')).tap();
    await waitForVisible(by.text('Review request created. It now appears under Approvals; this does not change the PII rule.'));
  });

  test.skip('optionally triages by swiping right', async () => {
    await element(by.id('triage-swipe-card')).swipe('right', 'fast', 0.8);
  });
});
