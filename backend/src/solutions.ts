/**
 * Solutions layer — promote approved + merged call sets into immutable Solutions.
 * Source: docs/ai/SOLUTIONS.md
 */

import type {
  ApproveCallSetRequest,
  AuditActor,
  CreateCallSetRequest,
  MergeCallSetRequest,
  Solution,
  SolutionCallSet,
  SolutionCallTurn,
} from '../../shared/types';
import { emitAudit, nextId, TENANT_ID, type Store } from './store';

function tenantCallSets(store: Store, tenantId: string): SolutionCallSet[] {
  if (!store.callSetsByTenant[tenantId]) store.callSetsByTenant[tenantId] = [];
  return store.callSetsByTenant[tenantId]!;
}

function tenantSolutions(store: Store, tenantId: string): Solution[] {
  if (!store.solutionsByTenant[tenantId]) store.solutionsByTenant[tenantId] = [];
  return store.solutionsByTenant[tenantId]!;
}

function requireNonEmpty(value: string, field: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw Object.assign(new Error(`${field} is required`), { status: 400 });
  }
  return trimmed;
}

function normalizeTurns(turns: SolutionCallTurn[] | undefined): SolutionCallTurn[] {
  if (!Array.isArray(turns)) return [];
  return turns
    .filter((t) => t && typeof t.content === 'string' && t.content.trim())
    .map((t) => ({
      role: t.role,
      content: t.content.trim(),
      ...(t.at ? { at: t.at } : {}),
    }));
}

export function listCallSets(store: Store, tenantId = TENANT_ID): SolutionCallSet[] {
  return [...tenantCallSets(store, tenantId)].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function listSolutions(store: Store, tenantId = TENANT_ID): Solution[] {
  return [...tenantSolutions(store, tenantId)].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getSolution(store: Store, id: string, tenantId = TENANT_ID): Solution | null {
  return tenantSolutions(store, tenantId).find((s) => s.id === id) ?? null;
}

export function getCallSet(store: Store, id: string, tenantId = TENANT_ID): SolutionCallSet | null {
  return tenantCallSets(store, tenantId).find((c) => c.id === id) ?? null;
}

export function createCallSet(
  store: Store,
  input: CreateCallSetRequest,
  tenantId = TENANT_ID,
): SolutionCallSet {
  const workItemId = requireNonEmpty(input.workItemId ?? '', 'workItemId');
  const workItem = store.workItems.find((w) => w.id === workItemId && w.tenantId === tenantId);
  if (!workItem) {
    throw Object.assign(new Error('work item not found'), { status: 404 });
  }

  const now = new Date().toISOString();
  const callSet: SolutionCallSet = {
    id: nextId('cset'),
    tenantId,
    workItemId,
    aiJobId: input.aiJobId ?? workItem.lastAiJobId,
    inputSummary: requireNonEmpty(input.inputSummary ?? '', 'inputSummary'),
    solutionSummary: requireNonEmpty(input.solutionSummary ?? '', 'solutionSummary'),
    turns: normalizeTurns(input.turns),
    artifactIds: Array.isArray(input.artifactIds) ? input.artifactIds.filter(Boolean) : [],
    approvalId: input.approvalId ?? null,
    approvedAt: null,
    approvedBy: null,
    mergeRef: null,
    mergedAt: null,
    status: 'open',
    categoryHint: input.categoryHint?.trim() || null,
    solutionId: null,
    createdAt: now,
    updatedAt: now,
  };
  tenantCallSets(store, tenantId).push(callSet);
  return callSet;
}

export function approveCallSet(
  store: Store,
  callSetId: string,
  input: ApproveCallSetRequest,
  actorId: string,
  tenantId = TENANT_ID,
): SolutionCallSet {
  const callSet = getCallSet(store, callSetId, tenantId);
  if (!callSet) throw Object.assign(new Error('call set not found'), { status: 404 });
  if (callSet.status === 'rejected') {
    throw Object.assign(new Error('rejected call set cannot be approved'), { status: 409 });
  }
  if (callSet.status === 'promoted') {
    throw Object.assign(new Error('promoted call set is immutable'), { status: 409 });
  }

  const now = new Date().toISOString();
  callSet.approvedAt = now;
  callSet.approvedBy = (input.approvedBy?.trim() || actorId).trim();
  callSet.updatedAt = now;
  if (callSet.status === 'open' || callSet.status === 'approved') {
    callSet.status = callSet.mergeRef ? 'merged' : 'approved';
  }
  return callSet;
}

export function mergeCallSet(
  store: Store,
  callSetId: string,
  input: MergeCallSetRequest,
  tenantId = TENANT_ID,
): SolutionCallSet {
  const callSet = getCallSet(store, callSetId, tenantId);
  if (!callSet) throw Object.assign(new Error('call set not found'), { status: 404 });
  if (callSet.status === 'rejected') {
    throw Object.assign(new Error('rejected call set cannot be merged'), { status: 409 });
  }
  if (callSet.status === 'promoted') {
    throw Object.assign(new Error('promoted call set is immutable'), { status: 409 });
  }

  const mergeRef = requireNonEmpty(input.mergeRef ?? '', 'mergeRef');
  const now = new Date().toISOString();
  callSet.mergeRef = mergeRef;
  callSet.mergedAt = now;
  callSet.updatedAt = now;
  if (callSet.approvedAt) {
    callSet.status = 'merged';
  }
  return callSet;
}

export function rejectCallSet(
  store: Store,
  callSetId: string,
  tenantId = TENANT_ID,
): SolutionCallSet {
  const callSet = getCallSet(store, callSetId, tenantId);
  if (!callSet) throw Object.assign(new Error('call set not found'), { status: 404 });
  if (callSet.status === 'promoted') {
    throw Object.assign(new Error('promoted call set cannot be rejected'), { status: 409 });
  }
  callSet.status = 'rejected';
  callSet.updatedAt = new Date().toISOString();
  return callSet;
}

/**
 * Hard gate: approved + merged → immutable Solution.
 * Idempotent when already promoted.
 */
export function promoteCallSet(
  store: Store,
  callSetId: string,
  actor: AuditActor,
  tenantId = TENANT_ID,
): { callSet: SolutionCallSet; solution: Solution } {
  const callSet = getCallSet(store, callSetId, tenantId);
  if (!callSet) throw Object.assign(new Error('call set not found'), { status: 404 });

  if (callSet.status === 'promoted' && callSet.solutionId) {
    const existing = getSolution(store, callSet.solutionId, tenantId);
    if (existing) return { callSet, solution: existing };
  }

  if (!callSet.approvedAt || !callSet.approvedBy) {
    throw Object.assign(new Error('call set must be approved before promote'), { status: 409 });
  }
  if (!callSet.mergeRef || !callSet.mergedAt) {
    throw Object.assign(new Error('call set must be merged before promote'), { status: 409 });
  }
  if (callSet.status === 'rejected') {
    throw Object.assign(new Error('rejected call set cannot be promoted'), { status: 409 });
  }

  const now = new Date().toISOString();
  const solution: Solution = {
    id: nextId('sol'),
    tenantId,
    callSetId: callSet.id,
    workItemId: callSet.workItemId,
    category: callSet.categoryHint?.trim() || 'uncategorized',
    inputSummary: callSet.inputSummary,
    solutionSummary: callSet.solutionSummary,
    turns: [...callSet.turns],
    artifactIds: [...callSet.artifactIds],
    mergeRef: callSet.mergeRef,
    mergedAt: callSet.mergedAt,
    approvedBy: callSet.approvedBy,
    approvedAt: callSet.approvedAt,
    status: 'active',
    usedByModelIds: [],
    usedBySkillIds: [],
    createdAt: now,
    updatedAt: now,
  };

  tenantSolutions(store, tenantId).push(solution);
  callSet.status = 'promoted';
  callSet.solutionId = solution.id;
  callSet.updatedAt = now;

  emitAudit(
    store,
    actor,
    'solution.promoted',
    { type: 'solution', id: solution.id },
    {
      callSetId: callSet.id,
      workItemId: callSet.workItemId,
      mergeRef: callSet.mergeRef,
      category: solution.category,
    },
    [1, 2, 3, 5],
  );

  return { callSet, solution };
}

export function archiveSolution(
  store: Store,
  solutionId: string,
  tenantId = TENANT_ID,
): Solution {
  const solution = getSolution(store, solutionId, tenantId);
  if (!solution) throw Object.assign(new Error('solution not found'), { status: 404 });
  solution.status = 'archived';
  solution.updatedAt = new Date().toISOString();
  return solution;
}
