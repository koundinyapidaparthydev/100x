/**
 * One-shot SCRUM AI-first screenshot capture for plan evidence.
 * Mode: sandbox unless OPENAI_API_KEY is live (documented in output JSON).
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const outDir = join(root, 'assets/ui-qa/e2e-scrum-ai');
const baseURL = process.env.WEB_BASE_URL || 'http://localhost:3000';
const apiURL = process.env.API_BASE_URL || 'http://localhost:4000';

mkdirSync(outDir, { recursive: true });

async function shot(page, name) {
  const path = join(outDir, name);
  await page.screenshot({ path, fullPage: true });
  console.log('shot', name);
  return path;
}

async function main() {
  const health = await fetch(`${apiURL}/api/v1/health`).then((r) => r.json());
  const login = await fetch(`${apiURL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: 'root', surface: 'web' }),
  }).then((r) => r.json());
  const token = login.session.token;
  const headers = { Authorization: `Bearer ${token}` };

  const pending = await fetch(`${apiURL}/api/v1/work-items?triagePending=true`, { headers }).then(
    (r) => r.json(),
  );
  const scrum =
    pending.find((i) => i.board?.issueKey === 'SCRUM-61') ||
    pending.find((i) => String(i.board?.issueKey || '').startsWith('SCRUM-')) ||
    pending[0];
  if (!scrum) throw new Error('No triage-pending SCRUM ticket found');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  await page.goto(`${baseURL}/login`);
  await page.evaluate(
    ({ token, user }) => {
      localStorage.setItem(
        'aplifyai-demo-session',
        JSON.stringify({
          token,
          id: user.id,
          role: user.isWorkspaceOwner ? 'root' : 'manager',
          surface: 'web',
        }),
      );
      localStorage.setItem(
        'aplifyai-onboarding',
        JSON.stringify({
          plan: 'free',
          selectedServices: ['jira', 'slack', 'github'],
          completedAt: new Date().toISOString(),
          lite: { intents: ['triage'], intent: 'triage' },
        }),
      );
    },
    { token, user: login.session.user },
  );

  // 1. Triage deck
  await page.goto(`${baseURL}/triage`);
  await page.getByTestId('triage-page').waitFor({ timeout: 30_000 });
  await page.getByTestId(`triage-card-${scrum.board.issueKey}`).waitFor({ timeout: 20_000 });
  await shot(page, '01-web-triage-deck.png');

  // Desktop rail + console group
  await page.goto(`${baseURL}/console`);
  await page.getByTestId('desktop-sidebar').waitFor({ timeout: 15_000 });
  await shot(page, '02-web-desktop-console-rail.png');

  // 2. AI-first from triage
  await page.goto(`${baseURL}/triage`);
  await page.getByTestId(`triage-ai-${scrum.board.issueKey}`).click();
  await page.getByTestId('triage-notice').waitFor({ timeout: 45_000 });
  await shot(page, '03-web-triage-after-ai-first.png');

  // Poll job
  let workItem = await fetch(`${apiURL}/api/v1/work-items/${encodeURIComponent(scrum.id)}`, {
    headers,
  }).then((r) => r.json());
  let job = null;
  for (let i = 0; i < 40; i++) {
    workItem = await fetch(`${apiURL}/api/v1/work-items/${encodeURIComponent(scrum.id)}`, {
      headers,
    }).then((r) => r.json());
    if (workItem.lastAiJobId) {
      job = await fetch(`${apiURL}/api/v1/ai-jobs/${encodeURIComponent(workItem.lastAiJobId)}`, {
        headers,
      }).then((r) => r.json());
      if (['ready_for_human', 'blocked_pii', 'failed', 'cancelled'].includes(job.state)) break;
    }
    await page.waitForTimeout(750);
  }

  // Ticket detail
  await page.goto(
    `${baseURL}/projects/${encodeURIComponent(scrum.board.projectId)}/work/${encodeURIComponent(scrum.id)}`,
  );
  await page.getByTestId('task-detail-page').waitFor({ timeout: 20_000 });
  await shot(page, '04-web-ticket-detail-estimate.png');

  // Approvals
  await page.goto(`${baseURL}/approvals`);
  await page.waitForTimeout(800);
  await shot(page, '05-web-approvals.png');

  // Connections (env banner + jira)
  await page.goto(`${baseURL}/connections`);
  await page.getByTestId('connections-page').waitFor({ timeout: 20_000 });
  await page.getByTestId('connections-list').waitFor({ timeout: 20_000 });
  await shot(page, '06-web-connections.png');

  // PII governance
  await page.goto(`${baseURL}/governance/pii`);
  await page.waitForTimeout(800);
  await shot(page, '07-web-pii-rules.png');

  // Audit as jobs/activity proxy
  await page.goto(`${baseURL}/audit`);
  await page.waitForTimeout(800);
  await shot(page, '08-web-audit-jobs-trail.png');

  const meta = {
    capturedAt: new Date().toISOString(),
    mode: health.modelRunner === 'openai' ? 'live-openai' : 'sandbox',
    modelRunner: health.modelRunner,
    boardConnector: health.boardConnector,
    ticket: {
      id: scrum.id,
      issueKey: scrum.board.issueKey,
      projectId: scrum.board.projectId,
      title: scrum.title,
    },
    afterTriage: {
      aiStatus: workItem.aiStatus,
      lastTriageDecision: workItem.lastTriageDecision,
      targetCompletionPercent: workItem.targetCompletionPercent,
      lastAiJobId: workItem.lastAiJobId,
    },
    job: job
      ? {
          id: job.id,
          state: job.state,
          artifactCount: job.artifacts?.length ?? 0,
        }
      : null,
    openaiKeyPresent: false,
    note:
      health.modelRunner === 'sandbox'
        ? 'OPENAI_API_KEY missing — AI path used sandbox canned drafts. UI + Jira MCP path exercised.'
        : 'Live OpenAI drafts used.',
  };
  writeFileSync(join(outDir, 'run-meta.json'), JSON.stringify(meta, null, 2));
  console.log(JSON.stringify(meta, null, 2));

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
