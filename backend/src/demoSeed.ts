/**
 * Code MVP demo seed — one tenant, one password manager, three tickets.
 * Idempotent: safe to re-run against an existing store (persist / restart).
 */

import type { CustomRole, OnboardingProfile, WorkItem } from '../../shared/types';
import { TENANT_ID, type Store } from './store';

export const DEMO_MANAGER_ID = 'usr-manager-1';
export const DEMO_MANAGER_EMAIL = 'manager@acme.demo';
export const DEMO_MANAGER_ROLE_ID = 'role-demo-manager';
export const DEMO_BOARD_PROJECT = 'MVP';

export const DEMO_TICKET_A = 'wi-mvp-a';
export const DEMO_TICKET_B = 'wi-mvp-b';
export const DEMO_TICKET_C = 'wi-mvp-c';

/** Raw PII that must never reach a model prompt (ticket B). */
export const DEMO_TICKET_B_EMAIL = 'jordan.lee@example.com';
export const DEMO_TICKET_B_PHONE = '+1 (415) 555-0142';

export const DEMO_SEED_VERSION = 1;

export interface DemoSeedMeta {
  version: number;
  tenantId: string;
  managerEmail: string;
  managerId: string;
  tickets: { a: string; b: string; c: string };
  seededAt: string;
}

export function defaultDemoManagerPassword(): string {
  const fromEnv = process.env.DEMO_MANAGER_PASSWORD?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : 'demo';
}

export function hasDemoSeed(store: Store): boolean {
  const meta = store.demoSeed;
  if (!meta || meta.version < 1) return false;
  const ids = new Set(store.workItems.map((w) => w.id));
  return ids.has(DEMO_TICKET_A) && ids.has(DEMO_TICKET_B) && ids.has(DEMO_TICKET_C);
}

function completedOnboarding(): OnboardingProfile {
  const now = new Date().toISOString();
  return {
    plan: 'free',
    completedAt: now,
    selectedServices: ['jira'],
    otherByCategory: {},
    lite: {
      intents: ['triage'],
      intent: 'triage',
      teamSize: '6-20',
      biggestPains: ['Triage backlog'],
      urgency: 'this_month',
      primaryBoards: ['jira'],
    },
    updatedAt: now,
  };
}

function upsertWorkItem(store: Store, item: WorkItem): void {
  const existing = store.workItems.find((w) => w.id === item.id);
  if (existing) {
    existing.title = item.title;
    existing.description = item.description;
    existing.labels = [...item.labels];
    existing.aiFirst = item.aiFirst;
    existing.lastTriageDecision = item.lastTriageDecision;
    existing.status = item.status;
    existing.priority = item.priority;
    existing.board = { ...item.board };
    return;
  }
  store.workItems.push(item);
}

export function applyDemoSeed(store: Store): DemoSeedMeta {
  const now = new Date().toISOString();

  const managerRole: CustomRole = {
    id: DEMO_MANAGER_ROLE_ID,
    tenantId: TENANT_ID,
    name: 'Demo Manager',
    description: 'Code MVP manager — triage tickets and review AI drafts.',
    subject: 'user',
    rules: [
      { kind: 'platform', capability: 'work_items.triage' },
      { kind: 'platform', capability: 'approvals.read' },
      { kind: 'platform', capability: 'approvals.decide' },
      { kind: 'platform', capability: 'boards.connect' },
    ],
    createdAt: now,
    updatedAt: now,
  };
  const roles = store.rolesByTenant[TENANT_ID] ?? (store.rolesByTenant[TENANT_ID] = []);
  if (!roles.some((r) => r.id === DEMO_MANAGER_ROLE_ID)) roles.push(managerRole);

  const users = store.usersByTenant[TENANT_ID] ?? (store.usersByTenant[TENANT_ID] = []);
  const manager = users.find((u) => u.id === DEMO_MANAGER_ID);
  if (manager) {
    manager.roleId = DEMO_MANAGER_ROLE_ID;
    manager.workspaceSetupComplete = true;
    manager.email = DEMO_MANAGER_EMAIL;
  }

  const grants = store.environmentGrantsByTenant[TENANT_ID] ?? (store.environmentGrantsByTenant[TENANT_ID] = []);
  const prodEnv = store.environmentsByTenant[TENANT_ID]?.find((e) => e.key === 'prod');
  const envId = prodEnv?.id ?? store.activeEnvironmentByTenant[TENANT_ID] ?? 'env-prod';
  if (!grants.some((g) => g.userId === DEMO_MANAGER_ID && g.environmentId === envId)) {
    grants.push({ userId: DEMO_MANAGER_ID, environmentId: envId, roleId: DEMO_MANAGER_ROLE_ID });
  }

  store.onboardingByUser[DEMO_MANAGER_ID] = completedOnboarding();

  if (!store.boards.some((b) => b.projectId === DEMO_BOARD_PROJECT)) {
    store.boards.push({
      projectId: DEMO_BOARD_PROJECT,
      name: 'Code MVP sandbox',
      connectedAt: now,
      lastSyncAt: now,
    });
  }

  upsertWorkItem(store, {
    id: DEMO_TICKET_A,
    tenantId: TENANT_ID,
    board: { type: 'jira', projectId: DEMO_BOARD_PROJECT, issueKey: 'MVP-A', issueId: 'mvp-a' },
    title: 'Add retry on empty sandbox draft',
    status: 'To Do',
    assigneeExternalId: null,
    labels: ['backend', 'ai-first'],
    aiFirst: true,
    targetCompletionPercent: 20,
    aiStatus: 'none',
    lastAiJobId: null,
    lastTriageDecision: null,
    description:
      'When the sandbox runner returns an empty draft, retry once and then fail the job with a clear error. No customer identifiers in this ticket.',
    priority: 'medium',
    updatedAt: now,
  });

  upsertWorkItem(store, {
    id: DEMO_TICKET_B,
    tenantId: TENANT_ID,
    board: { type: 'jira', projectId: DEMO_BOARD_PROJECT, issueKey: 'MVP-B', issueId: 'mvp-b' },
    title: 'Follow up with reporter about login flake',
    status: 'To Do',
    assigneeExternalId: null,
    labels: ['backend', 'pii'],
    aiFirst: true,
    targetCompletionPercent: 20,
    aiStatus: 'none',
    lastAiJobId: null,
    lastTriageDecision: null,
    description:
      `Reporter ${DEMO_TICKET_B_EMAIL} can be reached at ${DEMO_TICKET_B_PHONE}. ` +
      'The login flake reproduces on the staging web client after idle timeout. Draft a repro checklist; do not contact the reporter from the model.',
    priority: 'high',
    updatedAt: now,
  });

  upsertWorkItem(store, {
    id: DEMO_TICKET_C,
    tenantId: TENANT_ID,
    board: { type: 'jira', projectId: DEMO_BOARD_PROJECT, issueKey: 'MVP-C', issueId: 'mvp-c' },
    title: 'Negotiate vendor contract language',
    status: 'To Do',
    assigneeExternalId: 'u-legal',
    labels: ['human-first', 'legal'],
    aiFirst: false,
    targetCompletionPercent: 20,
    aiStatus: 'none',
    lastAiJobId: null,
    lastTriageDecision: 'human_first',
    description:
      'Legal must review the indemnity clause with the vendor. This is a human-first ticket — AI must not run.',
    priority: 'high',
    updatedAt: now,
  });

  const meta: DemoSeedMeta = {
    version: DEMO_SEED_VERSION,
    tenantId: TENANT_ID,
    managerEmail: DEMO_MANAGER_EMAIL,
    managerId: DEMO_MANAGER_ID,
    tickets: { a: DEMO_TICKET_A, b: DEMO_TICKET_B, c: DEMO_TICKET_C },
    seededAt: now,
  };
  store.demoSeed = meta;
  return meta;
}
