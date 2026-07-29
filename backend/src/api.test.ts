/**
 * API contract tests (vitest + supertest) against a fresh app/store per suite.
 */

import type { Express } from 'express';
import supertest from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import type {
  AiJob,
  ApprovalItem,
  AuditEvent,
  DashboardStats,
  TriageResponse,
  WorkItem,
} from '../../shared/types';
import { createApp } from './app';
import { estimateTokens } from './orchestrator';
import { createSeedStore, type Store } from './store';

let store: Store;
let app: Express;
let req: ReturnType<typeof supertest>;

beforeEach(() => {
  store = createSeedStore();
  app = createApp(store);
  req = supertest(app);
});

describe('health', () => {
  it('GET /health returns ok + version', async () => {
    const res = await req.get('/api/v1/health').expect(200);
    expect(res.body).toEqual({ status: 'ok', version: expect.any(String) });
  });
});

describe('work items', () => {
  it('lists all seeded work items', async () => {
    const res = await req.get('/api/v1/work-items').expect(200);
    const items = res.body as WorkItem[];
    expect(items).toHaveLength(8);
    expect(new Set(items.map((w) => w.board.projectId))).toEqual(new Set(['OH', 'INFRA', 'FE']));
  });

  it('filters by aiStatus and aiFirst', async () => {
    const running = await req.get('/api/v1/work-items?aiStatus=running').expect(200);
    expect((running.body as WorkItem[]).every((w) => w.aiStatus === 'running')).toBe(true);
    expect(running.body.length).toBeGreaterThan(0);

    const aiFirst = await req.get('/api/v1/work-items?aiFirst=false').expect(200);
    expect((aiFirst.body as WorkItem[]).every((w) => w.aiFirst === false)).toBe(true);
  });

  it('gets one work item, 404 {error} when missing', async () => {
    const ok = await req.get('/api/v1/work-items/wi-oh-101').expect(200);
    expect((ok.body as WorkItem).board.issueKey).toBe('OH-101');

    const missing = await req.get('/api/v1/work-items/nope').expect(404);
    expect(missing.body.error).toBeTruthy();
  });
});

describe('triage: human-first', () => {
  it('sets aiFirst=false, aiStatus none, job=null, and writes an audit event', async () => {
    const before = store.auditEvents.length;
    const res = await req
      .post('/api/v1/work-items/wi-oh-101/triage')
      .send({ aiFirst: false })
      .expect(200);
    const body = res.body as TriageResponse;
    expect(body.job).toBeNull();
    expect(body.workItem.aiFirst).toBe(false);
    expect(body.workItem.aiStatus).toBe('none');

    const newEvents = store.auditEvents.slice(before);
    expect(newEvents.some((e) => e.action === 'triage.human_first')).toBe(true);
  });

  it('400 on missing aiFirst, 404 on unknown work item', async () => {
    await req.post('/api/v1/work-items/wi-oh-101/triage').send({}).expect(400);
    await req.post('/api/v1/work-items/unknown/triage').send({ aiFirst: true }).expect(404);
  });
});

describe('triage: ai-first happy path', () => {
  it('runs the full pipeline to ready_for_human with artifacts + audit trail', async () => {
    const res = await req
      .post('/api/v1/work-items/wi-oh-101/triage')
      .send({ aiFirst: true, targetCompletionPercent: 20 })
      .expect(200);
    const body = res.body as TriageResponse;
    const job = body.job as AiJob;

    expect(job).not.toBeNull();
    expect(job.state).toBe('ready_for_human');
    expect(job.error).toBeNull();
    expect(job.tokenUsage.total).toBeGreaterThan(0);
    expect(job.finishedAt).not.toBeNull();

    // Artifacts: summary + patch, checksummed, policy-respecting storage URIs.
    expect(job.artifacts.length).toBeGreaterThanOrEqual(1);
    expect(job.artifacts.length).toBeLessThanOrEqual(2);
    for (const art of job.artifacts) {
      expect(art.checksum).toMatch(/^[0-9a-f]{64}$/);
      expect(art.storage.uri).toMatch(/^azure:\/\/eastus\/artifacts\/.+\.md$/);
      expect(art.boardAttachmentId).toMatch(/^att-\d+$/);
    }

    // WorkItem updated for hand-off.
    expect(body.workItem.aiFirst).toBe(true);
    expect(body.workItem.aiStatus).toBe('ready_for_human');
    expect(body.workItem.lastAiJobId).toBe(job.id);

    // Audit order: sanitizing MUST come before running (hard rule).
    const actions = store.auditEvents
      .filter((e) => e.resource.id === job.id)
      .map((e) => e.action);
    const expected = [
      'job.state.queued',
      'job.state.sanitizing',
      'job.state.running',
      'job.state.packaging',
      'job.state.attaching',
      'job.state.ready_for_human',
    ];
    expect(actions).toEqual(expected);
    expect(actions.indexOf('job.state.sanitizing')).toBeLessThan(actions.indexOf('job.state.running'));

    // ai_ready notification created.
    expect(store.notifications.some((n) => n.kind === 'ai_ready' && n.workItemId === body.workItem.id)).toBe(true);
  });

  it('redacts the seeded email ticket and still succeeds', async () => {
    const res = await req
      .post('/api/v1/work-items/wi-oh-103/triage')
      .send({ aiFirst: true })
      .expect(200);
    const job = (res.body as TriageResponse).job as AiJob;
    expect(job.state).toBe('ready_for_human');
    expect(job.piiReport.redactions).toBeGreaterThanOrEqual(1);
    expect(job.piiReport.blocks).toEqual([]);
    // The draft must not contain the raw email.
    expect(JSON.stringify(job.artifacts)).not.toContain('jane.doe@acme-corp.com');
  });
});

describe('triage: ai-first PII block', () => {
  it('blocks the seeded SSN ticket with zero token usage', async () => {
    const res = await req
      .post('/api/v1/work-items/wi-infra-221/triage')
      .send({ aiFirst: true })
      .expect(200);
    const body = res.body as TriageResponse;
    const job = body.job as AiJob;

    expect(job.state).toBe('blocked_pii');
    expect(job.piiReport.blocks).toContain('ssn');
    expect(job.tokenUsage).toEqual({ input: 0, output: 0, total: 0 });
    expect(job.finishedAt).not.toBeNull();
    expect(body.workItem.aiStatus).toBe('blocked_pii');

    // Never entered 'running'.
    const actions = store.auditEvents.filter((e) => e.resource.id === job.id).map((e) => e.action);
    expect(actions).toContain('job.state.sanitizing');
    expect(actions).not.toContain('job.state.running');
    expect(actions).toContain('job.state.blocked_pii');

    // Notification + never any raw SSN in report.
    expect(store.notifications.some((n) => n.kind === 'pii_block' && n.workItemId === 'wi-infra-221')).toBe(true);
    expect(JSON.stringify(job.piiReport)).not.toContain('123-45-6789');
  });
});

describe('token budget enforcement', () => {
  it('fails before running when the estimate exceeds the budget', async () => {
    // Lower the org budget so the estimate for wi-oh-101 cannot fit.
    const policy = store.policies[0]!;
    const wi = store.workItems.find((w) => w.id === 'wi-oh-101')!;
    const estimate = estimateTokens(`${wi.title}\n\n${wi.description}`.length);
    policy.tokenBudget.maxTotalTokens = estimate.total - 1;

    const res = await req
      .post('/api/v1/work-items/wi-oh-101/triage')
      .send({ aiFirst: true })
      .expect(200);
    const body = res.body as TriageResponse;
    const job = body.job as AiJob;

    expect(job.state).toBe('failed');
    expect(job.error).toBe('token_budget_exceeded');
    expect(job.tokenUsage.total).toBe(0);
    expect(body.workItem.aiStatus).toBe('failed');

    const actions = store.auditEvents.filter((e) => e.resource.id === job.id).map((e) => e.action);
    expect(actions).not.toContain('job.state.running');
    expect(actions).toContain('job.state.failed');
  });
});

describe('jobs / policies / boards / audit / notifications', () => {
  it('lists and gets ai-jobs (404 when missing)', async () => {
    const list = await req.get('/api/v1/ai-jobs').expect(200);
    expect((list.body as AiJob[]).length).toBeGreaterThanOrEqual(2);
    const one = await req.get('/api/v1/ai-jobs/job-running-1').expect(200);
    expect((one.body as AiJob).state).toBe('running');
    await req.get('/api/v1/ai-jobs/nope').expect(404);
  });

  it('lists and gets policies (404 when missing)', async () => {
    const list = await req.get('/api/v1/policies').expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].cloud).toEqual({ provider: 'azure', mode: 'private_vpc', region: 'eastus' });
    await req.get(`/api/v1/policies/${list.body[0].id}`).expect(200);
    await req.get('/api/v1/policies/nope').expect(404);
  });

  it('derives board health from seeded projects', async () => {
    const res = await req.get('/api/v1/boards').expect(200);
    expect(res.body).toHaveLength(3);
    const keys = res.body.map((b: { issuePrefix: string }) => b.issuePrefix).sort();
    expect(keys).toEqual(['FE', 'INFRA', 'OH']);
    expect(res.body.every((b: { activeIssues: number }) => b.activeIssues > 0)).toBe(true);
  });

  it('returns audit events newest first', async () => {
    await req.post('/api/v1/work-items/wi-oh-101/triage').send({ aiFirst: false });
    const res = await req.get('/api/v1/audit-events').expect(200);
    const events = res.body as AuditEvent[];
    expect(events.length).toBeGreaterThan(0);
    expect(events[0]!.action).toBe('triage.human_first'); // newest first
    for (let i = 1; i < events.length; i++) {
      expect(Date.parse(events[i - 1]!.createdAt)).toBeGreaterThanOrEqual(Date.parse(events[i]!.createdAt));
    }
  });

  it('lists notifications', async () => {
    const res = await req.get('/api/v1/notifications').expect(200);
    expect(res.body.length).toBeGreaterThanOrEqual(5);
  });
});

describe('approvals', () => {
  it('decides an approval (200) and writes an audit event', async () => {
    const before = store.auditEvents.length;
    const res = await req
      .post('/api/v1/approvals/app-infra-221/decision')
      .send({ decision: 'approved' })
      .expect(200);
    const approval = res.body as ApprovalItem;
    expect(approval.status).toBe('approved');

    const events = store.auditEvents.slice(before);
    expect(events.some((e) => e.action === 'approval.approved')).toBe(true);
  });

  it('audits rejections too', async () => {
    const before = store.auditEvents.length;
    const res = await req
      .post('/api/v1/approvals/app-fe-118/decision')
      .send({ decision: 'rejected' })
      .expect(200);
    expect((res.body as ApprovalItem).status).toBe('rejected');
    expect(store.auditEvents.slice(before).some((e) => e.action === 'approval.rejected')).toBe(true);
  });

  it('400 on a bad decision value', async () => {
    await req.post('/api/v1/approvals/app-infra-221/decision').send({ decision: 'maybe' }).expect(400);
  });

  it('404 on an unknown approval', async () => {
    await req.post('/api/v1/approvals/nope/decision').send({ decision: 'approved' }).expect(404);
  });
});

describe('stats', () => {
  it('has the DashboardStats shape', async () => {
    const res = await req.get('/api/v1/stats').expect(200);
    const stats = res.body as DashboardStats;
    expect(stats).toMatchObject({
      activeJobs: expect.any(Number),
      queuedJobs: expect.any(Number),
      readyForHuman: expect.any(Number),
      piiBlocks24h: expect.any(Number),
      piiRedactions24h: expect.any(Number),
      tokenUsageToday: {
        input: expect.any(Number),
        output: expect.any(Number),
        total: expect.any(Number),
      },
      tokenBudget: 50_000,
      tokenBudgetUsedPercent: expect.any(Number),
    });
    // Seeded: 1 running job, 1 queued job.
    expect(stats.activeJobs).toBe(1);
    expect(stats.queuedJobs).toBe(1);
  });

  it('reflects a PII block within the 24h window', async () => {
    await req.post('/api/v1/work-items/wi-infra-221/triage').send({ aiFirst: true });
    const res = await req.get('/api/v1/stats').expect(200);
    expect((res.body as DashboardStats).piiBlocks24h).toBe(1);
  });
});

describe('unknown routes', () => {
  it('returns a JSON 404', async () => {
    const res = await req.get('/api/v1/does-not-exist').expect(404);
    expect(res.body.error).toBeTruthy();
  });
});
