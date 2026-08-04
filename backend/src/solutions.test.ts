/**
 * Solutions + learning layer tests.
 * Source: docs/ai/SOLUTIONS.md, docs/ai/MODELS_AND_SKILLS.md
 */

import type { Express } from 'express';
import supertest from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import type { CustomModel, SkillPack, Solution, SolutionCallSet } from '../../shared/types';
import { createApp } from './app';
import { createSeedStore, type Store } from './store';

let store: Store;
let app: Express;
let req: ReturnType<typeof supertest>;
let ownerToken: string;
let workItemId: string;

beforeEach(async () => {
  store = createSeedStore();
  app = createApp(store);
  req = supertest(app);
  const login = await req.post('/api/v1/auth/login').send({ identity: 'root' });
  ownerToken = login.body.session.token as string;
  workItemId = store.workItems[0]!.id;
});

async function createApprovedMergedCallSet(): Promise<SolutionCallSet> {
  const created = await req
    .post('/api/v1/call-sets')
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({
      workItemId,
      inputSummary: 'Cleared ticket: rename button label on settings page',
      solutionSummary: 'Updated copy in SettingsHeader and added i18n key',
      categoryHint: 'text_change',
      turns: [
        { role: 'user', content: 'Rename the Save button to Apply' },
        { role: 'assistant', content: 'Draft patch touching SettingsHeader.tsx' },
      ],
    })
    .expect(201);

  const callSet = created.body as SolutionCallSet;
  await req
    .post(`/api/v1/call-sets/${callSet.id}/approve`)
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({})
    .expect(200);
  await req
    .post(`/api/v1/call-sets/${callSet.id}/merge`)
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({ mergeRef: 'https://gitlab.example/acme/app/-/merge_requests/42' })
    .expect(200);
  return callSet;
}

describe('solutions promotion gate', () => {
  it('refuses promote until approved and merged', async () => {
    const created = await req
      .post('/api/v1/call-sets')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        workItemId,
        inputSummary: 'input',
        solutionSummary: 'solution',
      })
      .expect(201);
    const id = (created.body as SolutionCallSet).id;

    await req
      .post(`/api/v1/call-sets/${id}/promote`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(409);

    await req
      .post(`/api/v1/call-sets/${id}/approve`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({})
      .expect(200);

    await req
      .post(`/api/v1/call-sets/${id}/promote`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(409);
  });

  it('promotes approved+merged call set into an immutable Solution', async () => {
    const callSet = await createApprovedMergedCallSet();
    const res = await req
      .post(`/api/v1/call-sets/${callSet.id}/promote`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(201);

    const solution = res.body.solution as Solution;
    expect(solution.category).toBe('text_change');
    expect(solution.mergeRef).toContain('merge_requests/42');
    expect(solution.status).toBe('active');
    expect((res.body.callSet as SolutionCallSet).status).toBe('promoted');

    const listed = await req
      .get('/api/v1/solutions')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(listed.body.solutions).toHaveLength(1);

    // Idempotent promote
    const again = await req
      .post(`/api/v1/call-sets/${callSet.id}/promote`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(201);
    expect((again.body.solution as Solution).id).toBe(solution.id);
  });
});

describe('custom models from solutions', () => {
  it('trains a sandbox custom model on linked Solutions', async () => {
    const callSet = await createApprovedMergedCallSet();
    const promoted = await req
      .post(`/api/v1/call-sets/${callSet.id}/promote`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(201);
    const solutionId = (promoted.body.solution as Solution).id;

    const created = await req
      .post('/api/v1/custom-models')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Acme text-change model', solutionIds: [solutionId] })
      .expect(201);
    const model = created.body as CustomModel;
    expect(model.status).toBe('collecting');
    expect(model.matchThreshold).toBe(0.9);

    const trained = await req
      .post(`/api/v1/custom-models/${model.id}/train`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect((trained.body as CustomModel).status).toBe('ready');
    expect((trained.body as CustomModel).artifactUri).toContain(model.id);
  });

  it('blocks train with zero Solutions', async () => {
    const created = await req
      .post('/api/v1/custom-models')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Empty model' })
      .expect(201);
    await req
      .post(`/api/v1/custom-models/${(created.body as CustomModel).id}/train`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(409);
  });
});

describe('skill packs from solutions', () => {
  it('publishes and exports a skill pack after review evidence exists', async () => {
    const callSet = await createApprovedMergedCallSet();
    const promoted = await req
      .post(`/api/v1/call-sets/${callSet.id}/promote`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(201);
    const solutionId = (promoted.body.solution as Solution).id;

    const created = await req
      .post('/api/v1/skill-packs')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Text-change pack',
        category: 'text_change',
        instructions: 'Prefer existing i18n keys; keep copy changes minimal.',
        solutionIds: [solutionId],
        targetKits: ['cursor', 'claude_code'],
      })
      .expect(201);
    const pack = created.body as SkillPack;

    await req
      .post(`/api/v1/skill-packs/${pack.id}/submit-review`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    const published = await req
      .post(`/api/v1/skill-packs/${pack.id}/publish`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect((published.body as SkillPack).status).toBe('published');

    const exported = await req
      .get(`/api/v1/skill-packs/${pack.id}/export`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(exported.body.markdown).toContain('Text-change pack');
    expect(exported.body.markdown).toContain(solutionId);
  });
});
