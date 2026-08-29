/* global by, device, element, expect, waitFor */

const LONG_TIMEOUT = 30000;

async function waitForVisible(matcher, timeout = LONG_TIMEOUT) {
  await waitFor(element(matcher)).toBeVisible().withTimeout(timeout);
}

async function goBackFromTicket() {
  await waitForVisible(by.id('ticket-back-button'));
  await element(by.id('ticket-back-button')).tap();
}

async function completeOnboardingIfPresent() {
  try {
    await waitFor(element(by.id('onboarding-screen'))).toBeVisible().withTimeout(5000);
  } catch (_) {
    return;
  }
  try {
    await waitFor(element(by.id('onboarding-skip'))).toBeVisible().withTimeout(2000);
    await element(by.id('onboarding-skip')).tap();
  } catch (_) {
    await element(by.id('onboarding-next')).tap();
    await element(by.id('onboarding-next')).tap();
    await waitForVisible(by.id('onboarding-done'));
    await element(by.id('onboarding-done')).tap();
  }
}

/** Narrow the triage deck to a stable issue key without consuming unrelated cards. */
async function filterTriageQueue(issueKey) {
  await waitForVisible(by.id('triage-swipe-card'));
  await element(by.label('Search triage queue')).replaceText(issueKey);
  await waitForVisible(by.text(issueKey));
  await waitForVisible(by.id('triage-swipe-card'));
}

async function clearTriageFilter() {
  await element(by.label('Search triage queue')).replaceText('');
  await waitForVisible(by.id('triage-swipe-card'));
}

describe('100x manager journey', () => {
  beforeAll(async () => {
    // Avoid device.openURL mid-test — it can leave a RemoteView overlay that
    // blocks taps on login controls.
    await device.launchApp({ newInstance: true, delete: true });
  });

  it('enforces the auth gate and logs in', async () => {
    try {
      await waitFor(element(by.id('get-started-button'))).toBeVisible().withTimeout(8000);
      await element(by.id('get-started-button')).tap();
    } catch (_) {
      // Already past splash (auth gate may redirect straight to login).
    }

    await waitForVisible(by.id('login-primary-button'));
    await element(by.id('login-primary-button')).tap();
    await completeOnboardingIfPresent();
    // Deep seed lands on Triage with a swipeable card (18 pending).
    await waitForVisible(by.id('triage-swipe-card'));
  });

  it('navigates every manager tab', async () => {
    await element(by.id('tab-jobs')).tap();
    await waitForVisible(by.id('jobs-screen'));
    await waitForVisible(by.id('jobs-stats'));

    await element(by.id('tab-approvals')).tap();
    await waitForVisible(by.text('Exception requests — decisions are recorded, not auto-enacted.'));

    await element(by.id('tab-pii')).tap();
    await waitForVisible(by.text('Sensitive data'));

    await element(by.id('tab-account')).tap();
    await waitForVisible(by.id('account-screen'));
    await waitForVisible(by.id('account-profile'));
    await waitFor(element(by.id('account-manage-on-web')))
      .toBeVisible()
      .whileElement(by.id('account-screen'))
      .scroll(240, 'down');
    await waitFor(element(by.id('account-how-it-works')))
      .toBeVisible()
      .whileElement(by.id('account-screen'))
      .scroll(240, 'down');
    await waitFor(element(by.id('account-sign-out')))
      .toBeVisible()
      .whileElement(by.id('account-screen'))
      .scroll(200, 'down');

    await element(by.id('tab-triage')).tap();
    await waitForVisible(by.id('triage-swipe-card'));
  });

  it('opens ticket details from triage', async () => {
    await filterTriageQueue('X100-101');
    await element(by.id('triage-swipe-card')).tap();
    await waitForVisible(by.id('ticket-detail-screen'));
    await expect(element(by.text('Refactor authentication middleware'))).toBeVisible();

    await goBackFromTicket();
    await waitForVisible(by.id('triage-swipe-card'));
    await clearTriageFilter();
  });

  it('triages a ticket by swiping right (AI)', async () => {
    // Right swipe = AI-first; keep stable story ticket out of priority-sort races.
    await filterTriageQueue('X100-101');
    await element(by.id('triage-swipe-card')).swipe('right', 'fast', 0.8);
    await waitForVisible(by.id('ticket-detail-screen'));
    await expect(element(by.text('Refactor authentication middleware'))).toBeVisible();

    await goBackFromTicket();
    await clearTriageFilter();
    await waitForVisible(by.id('triage-swipe-card'));
  });

  it('triages a ticket human-first with the button fallback', async () => {
    await filterTriageQueue('X100-103');
    await element(by.id('triage-human-button')).tap();
    await clearTriageFilter();
    await waitForVisible(by.id('triage-swipe-card'));
  });

  it('triages a ticket AI-first and navigates to its details', async () => {
    // Button path (non-swipe) on a distinct pending ticket.
    await filterTriageQueue('FE-119');
    await element(by.id('triage-ai-button')).tap();
    await waitForVisible(by.id('ticket-detail-screen'));
    await expect(element(by.text('Dark mode contrast fixes on stats cards'))).toBeVisible();

    await goBackFromTicket();
    await clearTriageFilter();
    await waitForVisible(by.id('triage-swipe-card'));
  });

  it('approves a reachable pending approval', async () => {
    await element(by.id('tab-approvals')).tap();
    await waitForVisible(by.id('approvals-screen'));
    await waitFor(element(by.id('approval-approve-app-infra-221')))
      .toBeVisible()
      .whileElement(by.id('approvals-screen'))
      .scroll(220, 'down');
    await element(by.id('approval-approve-app-infra-221')).tap();
    await waitForVisible(by.text('approved · record only'));
  });

  it('requests PII access through a blocked ticket', async () => {
    await element(by.id('tab-triage')).tap();
    // Keep INFRA-221 reserved for the SSN block path (stable seed id).
    await filterTriageQueue('INFRA-221');
    await element(by.id('triage-ai-button')).tap();

    await waitForVisible(by.text('Blocked before model execution. Review the PII firewall.'));
    await element(by.text('Blocked before model execution. Review the PII firewall.')).tap();
    await waitForVisible(by.id('pii-request-access-button'));
    await element(by.id('pii-request-access-button')).tap();
    await waitForVisible(by.text('Review request created. It now appears under Approvals; this does not change the PII rule.'));
  });

  it('signs out from Account and returns to login', async () => {
    await element(by.id('tab-account')).tap();
    await waitForVisible(by.id('account-screen'));
    await waitFor(element(by.id('account-sign-out')))
      .toBeVisible()
      .whileElement(by.id('account-screen'))
      .scroll(300, 'down');
    await element(by.id('account-sign-out')).tap();
    await waitForVisible(by.id('login-primary-button'));
  });
});
