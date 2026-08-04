/**
 * Learning layer — custom models + skill packs built from Solutions only.
 * Source: docs/ai/MODELS_AND_SKILLS.md
 */

import type {
  AuditActor,
  CreateCustomModelRequest,
  CreateSkillPackRequest,
  CustomModel,
  LinkSolutionsRequest,
  SkillKitTarget,
  SkillPack,
  Solution,
} from '../../shared/types';
import { emitAudit, nextId, TENANT_ID, type Store } from './store';
import { getSolution, listSolutions } from './solutions';

const DEFAULT_MATCH_THRESHOLD = 0.9;
const KIT_TARGETS: SkillKitTarget[] = ['cursor', 'claude_code', 'codex', 'chatgpt', 'custom'];

function tenantModels(store: Store, tenantId: string): CustomModel[] {
  if (!store.customModelsByTenant[tenantId]) store.customModelsByTenant[tenantId] = [];
  return store.customModelsByTenant[tenantId]!;
}

function tenantSkills(store: Store, tenantId: string): SkillPack[] {
  if (!store.skillPacksByTenant[tenantId]) store.skillPacksByTenant[tenantId] = [];
  return store.skillPacksByTenant[tenantId]!;
}

function requireName(value: string | undefined, field: string): string {
  const trimmed = (value ?? '').trim();
  if (!trimmed) throw Object.assign(new Error(`${field} is required`), { status: 400 });
  return trimmed;
}

function activeSolutionIds(store: Store, ids: string[], tenantId: string): string[] {
  const unique = [...new Set(ids.filter(Boolean))];
  const active: string[] = [];
  for (const id of unique) {
    const solution = getSolution(store, id, tenantId);
    if (!solution) {
      throw Object.assign(new Error(`solution not found: ${id}`), { status: 404 });
    }
    if (solution.status !== 'active') {
      throw Object.assign(new Error(`solution is not active: ${id}`), { status: 409 });
    }
    active.push(id);
  }
  return active;
}

function markSolutionUsed(
  store: Store,
  solutionIds: string[],
  kind: 'model' | 'skill',
  consumerId: string,
  tenantId: string,
): void {
  for (const id of solutionIds) {
    const solution = getSolution(store, id, tenantId);
    if (!solution) continue;
    if (kind === 'model' && !solution.usedByModelIds.includes(consumerId)) {
      solution.usedByModelIds.push(consumerId);
    }
    if (kind === 'skill' && !solution.usedBySkillIds.includes(consumerId)) {
      solution.usedBySkillIds.push(consumerId);
    }
    solution.updatedAt = new Date().toISOString();
  }
}

export function listCustomModels(store: Store, tenantId = TENANT_ID): CustomModel[] {
  return [...tenantModels(store, tenantId)].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getCustomModel(store: Store, id: string, tenantId = TENANT_ID): CustomModel | null {
  return tenantModels(store, tenantId).find((m) => m.id === id) ?? null;
}

export function createCustomModel(
  store: Store,
  input: CreateCustomModelRequest,
  tenantId = TENANT_ID,
): CustomModel {
  const solutionIds = activeSolutionIds(store, input.solutionIds ?? [], tenantId);
  const threshold =
    typeof input.matchThreshold === 'number' && Number.isFinite(input.matchThreshold)
      ? input.matchThreshold
      : DEFAULT_MATCH_THRESHOLD;
  if (threshold < 0 || threshold > 1) {
    throw Object.assign(new Error('matchThreshold must be between 0 and 1'), { status: 400 });
  }

  const now = new Date().toISOString();
  const model: CustomModel = {
    id: nextId('cmodel'),
    tenantId,
    name: requireName(input.name, 'name'),
    status: 'collecting',
    solutionIds,
    matchThreshold: threshold,
    baseProvider: (input.baseProvider?.trim() || 'openai').trim(),
    baseModelId: (input.baseModelId?.trim() || 'gpt-4o-mini').trim(),
    artifactUri: null,
    error: null,
    createdAt: now,
    updatedAt: now,
  };
  tenantModels(store, tenantId).push(model);
  markSolutionUsed(store, solutionIds, 'model', model.id, tenantId);
  return model;
}

export function linkSolutionsToModel(
  store: Store,
  modelId: string,
  input: LinkSolutionsRequest,
  tenantId = TENANT_ID,
): CustomModel {
  const model = getCustomModel(store, modelId, tenantId);
  if (!model) throw Object.assign(new Error('custom model not found'), { status: 404 });
  if (model.status === 'archived' || model.status === 'training') {
    throw Object.assign(new Error(`cannot link solutions while model is ${model.status}`), {
      status: 409,
    });
  }
  const added = activeSolutionIds(store, input.solutionIds ?? [], tenantId);
  const merged = [...new Set([...model.solutionIds, ...added])];
  model.solutionIds = merged;
  model.updatedAt = new Date().toISOString();
  if (model.status === 'ready' || model.status === 'failed') {
    model.status = 'collecting';
    model.artifactUri = null;
    model.error = null;
  }
  markSolutionUsed(store, added, 'model', model.id, tenantId);
  return model;
}

/** Sandbox trainer — marks ready after a synchronous fake train when Solutions exist. */
export function trainCustomModel(
  store: Store,
  modelId: string,
  actor: AuditActor,
  tenantId = TENANT_ID,
): CustomModel {
  const model = getCustomModel(store, modelId, tenantId);
  if (!model) throw Object.assign(new Error('custom model not found'), { status: 404 });
  if (model.status === 'archived') {
    throw Object.assign(new Error('archived model cannot train'), { status: 409 });
  }
  if (model.solutionIds.length === 0) {
    throw Object.assign(new Error('link at least one Solution before training'), { status: 409 });
  }

  model.status = 'training';
  model.error = null;
  model.updatedAt = new Date().toISOString();

  // Sandbox: instant success. Real trainers swap here without changing the contract.
  model.status = 'ready';
  model.artifactUri = `sandbox://custom-models/${model.id}`;
  model.updatedAt = new Date().toISOString();

  emitAudit(
    store,
    actor,
    'custom_model.trained',
    { type: 'custom_model', id: model.id },
    {
      solutionCount: model.solutionIds.length,
      matchThreshold: model.matchThreshold,
      artifactUri: model.artifactUri,
    },
    [1, 2, 3, 4, 5],
  );
  return model;
}

export function archiveCustomModel(
  store: Store,
  modelId: string,
  tenantId = TENANT_ID,
): CustomModel {
  const model = getCustomModel(store, modelId, tenantId);
  if (!model) throw Object.assign(new Error('custom model not found'), { status: 404 });
  model.status = 'archived';
  model.updatedAt = new Date().toISOString();
  return model;
}

export function listSkillPacks(store: Store, tenantId = TENANT_ID): SkillPack[] {
  return [...tenantSkills(store, tenantId)].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getSkillPack(store: Store, id: string, tenantId = TENANT_ID): SkillPack | null {
  return tenantSkills(store, tenantId).find((s) => s.id === id) ?? null;
}

function normalizeKits(kits: SkillKitTarget[] | undefined): SkillKitTarget[] {
  if (!Array.isArray(kits) || kits.length === 0) return ['cursor', 'claude_code'];
  const out: SkillKitTarget[] = [];
  for (const kit of kits) {
    if (KIT_TARGETS.includes(kit) && !out.includes(kit)) out.push(kit);
  }
  if (out.length === 0) {
    throw Object.assign(new Error('at least one valid targetKits entry is required'), { status: 400 });
  }
  return out;
}

export function createSkillPack(
  store: Store,
  input: CreateSkillPackRequest,
  tenantId = TENANT_ID,
): SkillPack {
  const solutionIds = activeSolutionIds(store, input.solutionIds ?? [], tenantId);
  const now = new Date().toISOString();
  const pack: SkillPack = {
    id: nextId('skill'),
    tenantId,
    name: requireName(input.name, 'name'),
    category: requireName(input.category, 'category'),
    status: 'draft',
    solutionIds,
    targetKits: normalizeKits(input.targetKits),
    instructions: (input.instructions ?? '').trim(),
    publishedAt: null,
    publishedBy: null,
    createdAt: now,
    updatedAt: now,
  };
  tenantSkills(store, tenantId).push(pack);
  markSolutionUsed(store, solutionIds, 'skill', pack.id, tenantId);
  return pack;
}

export function linkSolutionsToSkill(
  store: Store,
  skillId: string,
  input: LinkSolutionsRequest,
  tenantId = TENANT_ID,
): SkillPack {
  const pack = getSkillPack(store, skillId, tenantId);
  if (!pack) throw Object.assign(new Error('skill pack not found'), { status: 404 });
  if (pack.status === 'archived' || pack.status === 'published') {
    throw Object.assign(new Error(`cannot link solutions while skill is ${pack.status}`), {
      status: 409,
    });
  }
  const added = activeSolutionIds(store, input.solutionIds ?? [], tenantId);
  pack.solutionIds = [...new Set([...pack.solutionIds, ...added])];
  pack.updatedAt = new Date().toISOString();
  markSolutionUsed(store, added, 'skill', pack.id, tenantId);
  return pack;
}

export function submitSkillForReview(
  store: Store,
  skillId: string,
  tenantId = TENANT_ID,
): SkillPack {
  const pack = getSkillPack(store, skillId, tenantId);
  if (!pack) throw Object.assign(new Error('skill pack not found'), { status: 404 });
  if (pack.status !== 'draft') {
    throw Object.assign(new Error('only draft skills can be submitted for review'), { status: 409 });
  }
  if (pack.solutionIds.length === 0) {
    throw Object.assign(new Error('link at least one Solution before review'), { status: 409 });
  }
  if (!pack.instructions.trim()) {
    throw Object.assign(new Error('instructions are required before review'), { status: 409 });
  }
  pack.status = 'review';
  pack.updatedAt = new Date().toISOString();
  return pack;
}

export function publishSkillPack(
  store: Store,
  skillId: string,
  actor: AuditActor,
  tenantId = TENANT_ID,
): SkillPack {
  const pack = getSkillPack(store, skillId, tenantId);
  if (!pack) throw Object.assign(new Error('skill pack not found'), { status: 404 });
  if (pack.status !== 'review' && pack.status !== 'draft') {
    throw Object.assign(new Error(`cannot publish skill in status ${pack.status}`), { status: 409 });
  }
  if (pack.solutionIds.length === 0) {
    throw Object.assign(new Error('link at least one Solution before publish'), { status: 409 });
  }
  if (!pack.instructions.trim()) {
    throw Object.assign(new Error('instructions are required before publish'), { status: 409 });
  }

  const now = new Date().toISOString();
  pack.status = 'published';
  pack.publishedAt = now;
  pack.publishedBy = actor.id;
  pack.updatedAt = now;

  emitAudit(
    store,
    actor,
    'skill_pack.published',
    { type: 'skill_pack', id: pack.id },
    {
      category: pack.category,
      solutionCount: pack.solutionIds.length,
      targetKits: pack.targetKits,
    },
    [1, 2, 3, 5],
  );
  return pack;
}

export function exportSkillPack(
  store: Store,
  skillId: string,
  tenantId = TENANT_ID,
): { pack: SkillPack; markdown: string; solutions: Solution[] } {
  const pack = getSkillPack(store, skillId, tenantId);
  if (!pack) throw Object.assign(new Error('skill pack not found'), { status: 404 });
  if (pack.status !== 'published') {
    throw Object.assign(new Error('only published skills can be exported'), { status: 409 });
  }

  const solutions = listSolutions(store, tenantId).filter((s) => pack.solutionIds.includes(s.id));
  const markdown = [
    `# ${pack.name}`,
    '',
    `Category: ${pack.category}`,
    `Kits: ${pack.targetKits.join(', ')}`,
    '',
    '## Instructions',
    '',
    pack.instructions,
    '',
    '## Evidence (Solutions)',
    '',
    ...solutions.map(
      (s) =>
        `- ${s.id} · ${s.category} · merge \`${s.mergeRef}\`\n  - Input: ${s.inputSummary.slice(0, 160)}\n  - Solution: ${s.solutionSummary.slice(0, 160)}`,
    ),
    '',
    '_Exported from AplifyAI — governed skill pack. Do not paste uncleared production data into agent kits._',
  ].join('\n');

  return { pack, markdown, solutions };
}

export function archiveSkillPack(store: Store, skillId: string, tenantId = TENANT_ID): SkillPack {
  const pack = getSkillPack(store, skillId, tenantId);
  if (!pack) throw Object.assign(new Error('skill pack not found'), { status: 404 });
  pack.status = 'archived';
  pack.updatedAt = new Date().toISOString();
  return pack;
}
