/**
 * Code MVP demo path — seed, /demo/run, PII gate, sandbox runner, failures.
 */
import type { Express } from 'express';
import supertest from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import type { AiJob, AuditEvent, DemoRunResponse, DemoStatusResponse, WorkItem } from '../../shared/types';
import { createApp } from './app';
import {
  applyDemoSeed,
  DEMO_MANAGER_EMAIL,
  DEMO_TICKET_A,
  DEMO_TICKET_B,
  DEMO_TICKET_B_EMAIL,
  DEMO_TICKET_B_PHONE,
  DEMO_TICKET_C,
  hasDemoSeed,
} from './demoSeed';
import type { ModelRunInput, ModelRunner } from './runners/model';
import { SandboxModelRunner } from './runners/model';
import { createSeedStore, type Store } from './store';

let store: Store;
let app: Express;
let req: ReturnType<typeof supertest>;

beforeEach(() => {
  store = createSeedStore();
  app = createApp(store);
  req = supertest(app);
});

describe('demo seed + status', () => {
  it('GET /demo/status is false until seed is applied', async () => {
    const before = await req.get('/api/v1/demo/status').expect(200);
    expect((before.body as DemoStatusResponse).seeded).toBe(false);
    applyDemoSeed(store);
    const after = await req.get('/api/v1/demo/status').expect(200);
    expect(after.body).toMatchObject({
      seeded: true,
      managerEmail: DEMO_MANAGER_EMAIL,
      tickets: { a: DEMO_TICKET_A, b: DEMO_TICKET_B, c: DEMO_TICKET_C },
    });
    expect(hasDemoSeed(store)).toBe(true);
  });

  it('password login works for the demo manager', async () => {
    applyDemoSeed(store);
    const ok = await req
      .post('/api/v1/auth/login')
      .send({ email: DEMO_MANAGER_EMAIL, password: 'demo', surface: 'web' })
      .expect(200);
    expect(ok.body.session.user.email).toBe(DEMO_MANAGER_EMAIL);
    await req
      .post('/api/v1/auth/login')
      .send({ email: DEMO_MANAGER_EMAIL, password: 'wrong', surface: 'web' })
      .expect(401);
  });
});

describe('POST /demo/run', () => {
  it('runs ticket A end-to-end with artifact + required audit events', async () => {
    const res = await req.post('/api/v1/demo/run').expect(200);
    const body = res.body as DemoRunResponse;
    expect(hasDemoSeed(store)).toBe(true);
    expect(body.job.state).toBe('ready_for_human');
    expect(body.job.error).toBeNull();
    expect(body.artifact).not.toBeNull();
    expect(body.artifact?.boardAttachmentId).toMatch(/^att-/);
    const actions = new Set(body.audit.map((e) => e.action));
    expect(actions.has('pii_scanned')).toBe(true);
    expect(actions.has('ai_started')).toBe(true);
    expect(actions.has('ai_finished')).toBe(true);
    expect(actions.has('artifact_attached')).toBe(true);
    expect(JSON.stringify(body)).not.toContain(DEMO_TICKET_B_EMAIL);
  });
});

describe('PII gate + ticket B/C', () => {
  it('redacts ticket B email/phone and never puts raw PII in the model prompt', async () => {
    applyDemoSeed(store);
    const captured: ModelRunInput[] = [];
    const runner: ModelRunner = {
      kind: 'sandbox',
      async run(input) {
        captured.push(input);
        return new SandboxModelRunner().run(input);
      },
    };
    const seeded = createApp({ store, modelRunner: runner });
    const login = await supertest(seeded).post('/api/v1/auth/login').send({ identity: 'root' });
    const token = login.body.session.token as string;
    const res = await supertest(seeded)
      .post(`/api/v1/work-items/${DEMO_TICKET_B}/triage`)
      .set('Authorization', `Bearer ${token}`)
      .send({ aiFirst: true })
      .expect(200);
    const job = res.body.job as AiJob;
    expect(job.state).toBe('ready_for_human');
    expect(job.piiReport.redactions).toBeGreaterThanOrEqual(2);
    expect(captured).toHaveLength(1);
    const prompt = `${captured[0]!.sanitized}\n${captured[0]!.sanitizedTitle}`;
    expect(prompt).not.toContain(DEMO_TICKET_B_EMAIL);
    expect(prompt).not.toContain(DEMO_TICKET_B_PHONE);
    expect(JSON.stringify(job.artifacts)).not.toContain(DEMO_TICKET_B_EMAIL);
    expect(store.auditEvents.some((e) => e.action === 'pii_redacted')).toBe(true);
  });

  it('refuses AI on human-first ticket C', async () => {
    applyDemoSeed(store);
    const login = await req.post('/api/v1/auth/login').send({ identity: 'root' });
    const token = login.body.session.token as string;
    await req
      .post(`/api/v1/work-items/${DEMO_TICKET_C}/triage`)
      .set('Authorization', `Bearer ${token}`)
      .send({ aiFirst: true })
      .expect(409);
    const item = store.workItems.find((w) => w.id === DEMO_TICKET_C) as WorkItem;
    expect(item.aiStatus).toBe('none');
    expect(item.lastTriageDecision).toBe('human_first');
  });
});

describe('failure paths', () => {
  it('token budget exceeded fails the job and audits without running the model', async () => {
    applyDemoSeed(store);
    store.policies.forEach((p) => {
      p.tokenBudget.maxTotalTokens = 1;
    });
    const login = await req.post('/api/v1/auth/login').send({ identity: 'root' });
    const token = login.body.session.token as string;
    const res = await req
      .post(`/api/v1/work-items/${DEMO_TICKET_A}/triage`)
      .set('Authorization', `Bearer ${token}`)
      .send({ aiFirst: true })
      .expect(200);
    const job = res.body.job as AiJob;
    expect(job.state).toBe('failed');
    expect(job.error).toBe('token_budget_exceeded');
    expect(store.auditEvents.some((e: AuditEvent) => e.action === 'token_budget_exceeded')).toBe(true);
    expect(store.auditEvents.some((e) => e.action === 'ai_started')).toBe(false);
  });

  it('model runner failure records a failed job and does not crash the API', async () => {
    applyDemoSeed(store);
    const runner: ModelRunner = {
      kind: 'sandbox',
      async run() {
        throw new Error('upstream_model_timeout');
      },
    };
    const failing = createApp({ store, modelRunner: runner });
    const login = await supertest(failing).post('/api/v1/auth/login').send({ identity: 'root' });
    const token = login.body.session.token as string;
    const res = await supertest(failing)
      .post(`/api/v1/work-items/${DEMO_TICKET_A}/triage`)
      .set('Authorization', `Bearer ${token}`)
      .send({ aiFirst: true })
      .expect(200);
    const job = res.body.job as AiJob;
    expect(job.state).toBe('failed');
    expect(job.error).toBe('upstream_model_timeout');
    expect(store.workItems.find((w) => w.id === DEMO_TICKET_A)?.aiStatus).toBe('failed');
  });

  it('createModelRunner stays sandbox when OPENAI_API_KEY is unset', async () => {
    const { createModelRunner } = await import('./runners/model');
    const prev = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    try {
      expect(createModelRunner({}).kind).toBe('sandbox');
    } finally {
      if (prev !== undefined) process.env.OPENAI_API_KEY = prev;
    }
  });
});
