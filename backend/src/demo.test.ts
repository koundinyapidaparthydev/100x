/**
 * Code MVP demo path — seed, /demo/run, PII gate, sandbox runner, failures.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
import { sanitize } from './pii';
import type { ModelRunInput, ModelRunner } from './runners/model';
import { SandboxModelRunner } from './runners/model';
import { createSeedStore, type Store } from './store';

const GOLDEN_AUDIT = JSON.parse(
  readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures/golden-audit-sequence.json'),
    'utf8',
  ),
) as { happyPath: string[] };

/** Fail if a payload accidentally contains live secrets or raw ticket-B PII. */
function assertNoSecrets(payload: unknown): void {
  const raw = JSON.stringify(payload);
  const banned = [
    DEMO_TICKET_B_EMAIL,
    process.env.OPENAI_API_KEY,
    process.env.ANTHROPIC_API_KEY,
    process.env.OPENROUTER_API_KEY,
    process.env.AUTH_SESSION_SECRET,
    process.env.DEMO_MANAGER_PASSWORD,
    process.env.DATABASE_URL,
  ].filter((value): value is string => Boolean(value && value.length > 3));
  for (const secret of banned) {
    expect(raw).not.toContain(secret);
  }
}

function assertAuditOrder(actions: string[], expected: string[]): void {
  let cursor = 0;
  for (const action of actions) {
    if (action === expected[cursor]) cursor += 1;
  }
  expect(cursor).toBe(expected.length);
}

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
    assertAuditOrder(
      body.audit.map((e) => e.action),
      GOLDEN_AUDIT.happyPath,
    );
    expect(JSON.stringify(body)).not.toContain(DEMO_TICKET_B_EMAIL);
    assertNoSecrets(body);
  });
});

describe('demo seed idempotent + list', () => {
  it('applyDemoSeed twice keeps one copy of A/B/C', () => {
    const first = applyDemoSeed(store);
    const second = applyDemoSeed(store);
    expect(second.tickets).toEqual(first.tickets);
    const ids = store.workItems.filter((w) =>
      [DEMO_TICKET_A, DEMO_TICKET_B, DEMO_TICKET_C].includes(w.id),
    );
    expect(ids).toHaveLength(3);
    expect(hasDemoSeed(store)).toBe(true);
  });

  it('seed → manager login → list includes MVP-A/B/C', async () => {
    applyDemoSeed(store);
    const login = await req
      .post('/api/v1/auth/login')
      .send({ email: DEMO_MANAGER_EMAIL, password: 'demo', surface: 'web' })
      .expect(200);
    const token = login.body.session.token as string;
    expect(token).toBeTruthy();
    assertNoSecrets({ login: { email: login.body.session.user.email, id: login.body.session.user.id } });
    const list = await req.get('/api/v1/work-items').set('Authorization', `Bearer ${token}`).expect(200);
    const items = list.body as WorkItem[];
    const keys = new Set(items.map((w) => w.board.issueKey));
    expect(keys.has('MVP-A')).toBe(true);
    expect(keys.has('MVP-B')).toBe(true);
    expect(keys.has('MVP-C')).toBe(true);
    assertNoSecrets(items.map((w) => ({ id: w.id, key: w.board.issueKey, title: w.title })));
  });
});

describe('PII unit: demo tickets A/B', () => {
  it('detects email and phone on ticket B', () => {
    applyDemoSeed(store);
    const item = store.workItems.find((w) => w.id === DEMO_TICKET_B) as WorkItem;
    const policy = store.policies[0]!;
    const { sanitized, report } = sanitize(`${item.title}\n${item.description}`, policy);
    expect(report.redactions).toBeGreaterThanOrEqual(2);
    expect(report.blocks).toEqual([]);
    expect(sanitized).not.toContain(DEMO_TICKET_B_EMAIL);
    expect(sanitized).not.toContain(DEMO_TICKET_B_PHONE);
    expect(item.description).toContain(DEMO_TICKET_B_EMAIL);
    expect(item.description).toContain(DEMO_TICKET_B_PHONE);
    expect(JSON.stringify(report)).not.toContain(DEMO_TICKET_B_EMAIL);
  });

  it('does not false-positive ticket A', () => {
    applyDemoSeed(store);
    const item = store.workItems.find((w) => w.id === DEMO_TICKET_A) as WorkItem;
    const policy = store.policies[0]!;
    const { sanitized, report } = sanitize(`${item.title}\n${item.description}`, policy);
    expect(report).toEqual({ redactions: 0, blocks: [] });
    expect(sanitized).toContain(item.title);
    expect(sanitized).toContain('No customer identifiers in this ticket');
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
    expect(store.jobs.some((j) => j.workItemId === DEMO_TICKET_C)).toBe(false);
    expect(store.auditEvents.some((e) => e.action === 'ai_started' && e.resource.id === DEMO_TICKET_C)).toBe(
      false,
    );
  });
});

describe('API: health + unauthenticated write', () => {
  it('GET /health shape is { ok, pii, runner, persist }', async () => {
    const res = await req.get('/api/v1/health').expect(200);
    expect(res.body).toMatchObject({
      ok: true,
      pii: true,
      runner: expect.any(String),
      persist: expect.stringMatching(/memory|file|postgres/),
    });
    assertNoSecrets(res.body);
  });

  it('unauthenticated triage write is 401', async () => {
    applyDemoSeed(store);
    await req.post(`/api/v1/work-items/${DEMO_TICKET_A}/triage`).send({ aiFirst: true }).expect(401);
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
    const usable = await supertest(failing).get(`/api/v1/work-items/${DEMO_TICKET_A}`).expect(200);
    expect((usable.body as WorkItem).id).toBe(DEMO_TICKET_A);
    expect((usable.body as WorkItem).board.issueKey).toBe('MVP-A');
    const retryHuman = await supertest(failing)
      .post(`/api/v1/work-items/${DEMO_TICKET_A}/triage`)
      .set('Authorization', `Bearer ${token}`)
      .send({ aiFirst: false })
      .expect(200);
    expect(retryHuman.body.workItem.lastTriageDecision).toBe('human_first');
    expect(retryHuman.body.job).toBeNull();
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
