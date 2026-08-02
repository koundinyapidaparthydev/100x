/**
 * In-memory data store for the demo tenant 'acme'.
 *
 * Foundation phases F1–F4 run without a database; everything lives in
 * process memory and is re-seeded per app instance (tests get a fresh store
 * per `createApp()`).
 *
 * Seed coverage required by the build spec:
 *  - 8 WorkItems across 3 Jira projects (APLIFYAI, INFRA, FE)
 *  - Connected boards start empty — connect via UI / API
 *  - one ticket with an email in its description (→ redact path, succeeds)
 *  - one ticket with an SSN in its description (→ blocked_pii path)
 *  - 1 org policy (azure eastus private_vpc, gpt-4o, 50k token budget)
 *  - a few pre-seeded jobs in 'running' / 'queued'
 *  - audit events, 2 pending approvals, ~5 notifications
 */

import type {
  AiJob,
  ApprovalItem,
  AuditActor,
  AuditEvent,
  NotificationItem,
  OnboardingProfile,
  Policy,
  ServiceMcpConnection,
  WorkItem,
} from '../../shared/types';

export const TENANT_ID = 'acme';
export const ORG_POLICY_ID = 'pol-acme-org';

export interface ConnectedBoard {
  projectId: string;
  name: string;
  connectedAt: string;
  lastSyncAt: string;
}

export interface Store {
  workItems: WorkItem[];
  policies: Policy[];
  jobs: AiJob[];
  auditEvents: AuditEvent[];
  approvals: ApprovalItem[];
  notifications: NotificationItem[];
  boards: ConnectedBoard[];
  /** Attachment id counter for board write-back (att-<n>). */
  attachmentCounter: number;
  /** Demo-tenant onboarding answers keyed by tenant id. */
  onboardingByTenant: Record<string, OnboardingProfile>;
  /** Per-tenant MCP connections (service → permission + granted tools). */
  mcpConnectionsByTenant: Record<string, ServiceMcpConnection[]>;
}

let idCounter = 0;
/** Deterministic-ish unique ids (monotonic per process; fine for in-memory). */
export function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

/** Append an audit event. Every AiJob transition and triage/approval action flows through here. */
export function emitAudit(
  store: Store,
  actor: AuditActor,
  action: string,
  resource: { type: string; id: string },
  metadata: Record<string, unknown> = {},
  securityLayersApplied: number[] = [],
): AuditEvent {
  const event: AuditEvent = {
    id: nextId('aud'),
    tenantId: TENANT_ID,
    actor,
    action,
    resource,
    securityLayersApplied,
    metadata,
    createdAt: new Date().toISOString(),
  };
  store.auditEvents.push(event);
  return event;
}

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3_600_000).toISOString();
}

export function createSeedStore(): Store {
  const policy: Policy = {
    id: ORG_POLICY_ID,
    tenantId: TENANT_ID,
    scope: 'org',
    securityLevel: 'elevated',
    // Default clearing styles per docs/security/PII_RESTRICTIONS.md + compliance UX.
    pii: {
      email: { mode: 'redact', style: 'fixed', fixedReplacement: 'user@cleared.invalid' },
      phone: { mode: 'redact', style: 'mask_keep_last', keepLastDigits: 4 },
      ssn: { mode: 'block' },
      credit_card: { mode: 'block', style: 'mask_keep_last', keepLastDigits: 4 },
      customer_name: { mode: 'hash' },
    },
    customerNames: ['Jane Doe', 'John Smith'],
    cloud: { provider: 'azure', mode: 'private_vpc', region: 'eastus' },
    model: { provider: 'openai', modelId: 'gpt-4o' },
    platform: { runtime: 'node22-sandbox', codeOverrideMode: 'allowed_with_audit' },
    tokenBudget: { maxTotalTokens: 50_000, maxCostUsd: 25, onExhaustion: 'block' },
    mcpAllowlist: [{ server: 'jira', tools: ['read_issue', 'add_comment'] }],
    aiFirstDefault: false,
    targetCompletionPercentDefault: 20,
    locks: { models: true, securityMin: true, cloud: false },
  };

  const workItems: WorkItem[] = [
    {
      id: 'wi-aplifyai-101',
      tenantId: TENANT_ID,
      board: { type: 'jira', projectId: 'APLIFYAI', issueKey: 'APLIFYAI-101', issueId: '10001' },
      title: 'Refactor authentication middleware',
      status: 'To Do',
      assigneeExternalId: null,
      labels: ['backend', 'security'],
      aiFirst: false,
      targetCompletionPercent: 20,
      aiStatus: 'none',
      lastAiJobId: null,
      lastTriageDecision: null,
      description:
        'The Express auth middleware has grown to 400+ lines with mixed JWT and session logic. ' +
        'Split it into strategy modules, add unit tests for token expiry edge cases, and keep the public API unchanged.',
      priority: 'high',
      updatedAt: hoursAgo(3),
    },
    {
      id: 'wi-aplifyai-102',
      tenantId: TENANT_ID,
      board: { type: 'jira', projectId: 'APLIFYAI', issueKey: 'APLIFYAI-102', issueId: '10002' },
      title: 'Fix pagination on audit log API',
      status: 'In Progress',
      assigneeExternalId: 'u-priya',
      labels: ['backend', 'bug'],
      aiFirst: true,
      targetCompletionPercent: 20,
      aiStatus: 'running',
      lastAiJobId: 'job-running-1',
      lastTriageDecision: 'ai_first',
      description:
        'GET /audit-events returns duplicate rows when crossing page boundaries. ' +
        'cursor should be (createdAt, id) instead of OFFSET. Repro: seed 150 events, page with limit=50.',
      priority: 'medium',
      updatedAt: hoursAgo(1),
    },
    {
      id: 'wi-aplifyai-103',
      tenantId: TENANT_ID,
      board: { type: 'jira', projectId: 'APLIFYAI', issueKey: 'APLIFYAI-103', issueId: '10003' },
      title: 'Add retry logic to webhook delivery',
      status: 'To Do',
      assigneeExternalId: null,
      labels: ['integrations'],
      aiFirst: false,
      targetCompletionPercent: 20,
      aiStatus: 'none',
      lastAiJobId: null,
      lastTriageDecision: null,
      // Email in description → PII redact path; the AI job must still succeed.
      description:
        'Webhook deliveries fail silently on 5xx. Add exponential backoff (3 attempts, jitter) and a dead-letter table. ' +
        'Questions go to the integration owner at jane.doe@acme-corp.com — she wrote the original dispatcher.',
      priority: 'medium',
      updatedAt: hoursAgo(6),
    },
    {
      id: 'wi-infra-221',
      tenantId: TENANT_ID,
      board: { type: 'jira', projectId: 'INFRA', issueKey: 'INFRA-221', issueId: '20221' },
      title: 'Rotate RDS credentials and audit secret access',
      status: 'To Do',
      assigneeExternalId: null,
      labels: ['infra', 'security', 'high-risk'],
      aiFirst: false,
      targetCompletionPercent: 10,
      aiStatus: 'none',
      lastAiJobId: null,
      lastTriageDecision: null,
      // SSN in description → PII block path; AI job must never reach 'running'.
      description:
        'Quarterly rotation for the primary RDS credentials. The compliance ticket references the on-call ' +
        'engineer record SSN 123-45-6789 from the legacy HR export — do not migrate that field, just rotate the DB secrets.',
      priority: 'critical',
      updatedAt: hoursAgo(2),
    },
    {
      id: 'wi-infra-222',
      tenantId: TENANT_ID,
      board: { type: 'jira', projectId: 'INFRA', issueKey: 'INFRA-222', issueId: '20222' },
      title: 'Add Terraform module for artifact bucket',
      status: 'To Do',
      assigneeExternalId: null,
      labels: ['infra', 'terraform'],
      aiFirst: true,
      targetCompletionPercent: 30,
      aiStatus: 'queued',
      lastAiJobId: 'job-queued-1',
      lastTriageDecision: 'ai_first',
      description:
        'Create a reusable Terraform module for the AI artifact storage bucket: versioning on, ' +
        'lifecycle rule to cold storage after 30 days, CMK encryption, and bucket policy denying public access.',
      priority: 'medium',
      updatedAt: hoursAgo(5),
    },
    {
      id: 'wi-infra-223',
      tenantId: TENANT_ID,
      board: { type: 'jira', projectId: 'INFRA', issueKey: 'INFRA-223', issueId: '20223' },
      title: 'Harden CI runner network egress',
      status: 'In Progress',
      assigneeExternalId: 'u-marcus',
      labels: ['infra', 'ci'],
      aiFirst: false,
      targetCompletionPercent: 10,
      aiStatus: 'none',
      lastAiJobId: null,
      lastTriageDecision: null,
      description:
        'CI runners currently have unrestricted egress. Restrict to the package registries and the artifact ' +
        'store; log denied destinations for a week before enforcing.',
      priority: 'high',
      updatedAt: hoursAgo(8),
    },
    {
      id: 'wi-fe-118',
      tenantId: TENANT_ID,
      board: { type: 'jira', projectId: 'FE', issueKey: 'FE-118', issueId: '30118' },
      title: 'Virtualize the work item list for large boards',
      status: 'To Do',
      assigneeExternalId: null,
      labels: ['frontend', 'performance'],
      aiFirst: false,
      targetCompletionPercent: 20,
      aiStatus: 'none',
      lastAiJobId: null,
      lastTriageDecision: null,
      description:
        'Boards with 2k+ work items drop frames on scroll. Window the list with react-window, keep swipe ' +
        'gestures working, and preserve the current filter/sort behavior.',
      priority: 'medium',
      updatedAt: hoursAgo(4),
    },
    {
      id: 'wi-fe-119',
      tenantId: TENANT_ID,
      board: { type: 'jira', projectId: 'FE', issueKey: 'FE-119', issueId: '30119' },
      title: 'Dark mode contrast fixes on stats cards',
      status: 'To Do',
      assigneeExternalId: null,
      labels: ['frontend', 'a11y'],
      aiFirst: false,
      targetCompletionPercent: 10,
      aiStatus: 'none',
      lastAiJobId: null,
      lastTriageDecision: null,
      description:
        'Token usage and PII block stat cards fail WCAG AA contrast in dark mode (4.5:1 for text). ' +
        'Update the palette tokens, not one-off hex values.',
      priority: 'low',
      updatedAt: hoursAgo(12),
    },
  ];

  // Pre-seeded jobs: one mid-flight 'running', one 'queued'.
  const jobs: AiJob[] = [
    {
      id: 'job-running-1',
      workItemId: 'wi-aplifyai-102',
      tenantId: TENANT_ID,
      state: 'running',
      model: { provider: policy.model.provider, modelId: policy.model.modelId },
      cloudExecution: { provider: 'azure', mode: 'private_vpc', region: 'eastus' },
      tokenUsage: { input: 420, output: 260, total: 680 },
      artifacts: [],
      piiReport: { redactions: 0, blocks: [] },
      error: null,
      createdAt: hoursAgo(1),
      finishedAt: null,
    },
    {
      id: 'job-queued-1',
      workItemId: 'wi-infra-222',
      tenantId: TENANT_ID,
      state: 'queued',
      model: { provider: policy.model.provider, modelId: policy.model.modelId },
      cloudExecution: { provider: 'azure', mode: 'private_vpc', region: 'eastus' },
      tokenUsage: { input: 0, output: 0, total: 0 },
      artifacts: [],
      piiReport: { redactions: 0, blocks: [] },
      error: null,
      createdAt: hoursAgo(0.5),
      finishedAt: null,
    },
  ];

  const store: Store = {
    workItems,
    policies: [policy],
    jobs,
    auditEvents: [],
    approvals: [
      {
        id: 'app-infra-221',
        workItemId: 'wi-infra-221',
        title: 'Allow code override on INFRA-221',
        reason:
          'AI patch touches credential rotation code; policy codeOverrideMode=allowed_with_audit requires manager sign-off.',
        risk: 'high',
        status: 'pending',
        requestedAt: hoursAgo(2),
      },
      {
        id: 'app-fe-118',
        workItemId: 'wi-fe-118',
        title: 'Extend token budget for FE-118',
        reason: 'Virtualization draft needs ~62k tokens, above the 50k org budget; manager can approve a one-off extension.',
        risk: 'medium',
        status: 'pending',
        requestedAt: hoursAgo(3),
      },
    ],
    notifications: [
      {
        id: 'ntf-1',
        kind: 'ai_ready',
        title: 'AI draft ready on APLIFYAI-97',
        body: 'Summary + patch attached to the board. Review before handing off.',
        createdAt: hoursAgo(7),
        read: true,
        workItemId: 'wi-aplifyai-101',
      },
      {
        id: 'ntf-2',
        kind: 'pii_block',
        title: 'PII block on INFRA-215',
        body: 'Job blocked: government ID detected in the ticket. Sanitize before re-running AI.',
        createdAt: hoursAgo(9),
        read: false,
        workItemId: 'wi-infra-221',
      },
      {
        id: 'ntf-3',
        kind: 'approval',
        title: 'Approval needed: INFRA-221',
        body: 'High-risk action "Allow code override on INFRA-221" is waiting for your decision.',
        createdAt: hoursAgo(2),
        read: false,
        workItemId: 'wi-infra-221',
      },
      {
        id: 'ntf-4',
        kind: 'approval',
        title: 'Approval needed: FE-118',
        body: 'Token budget extension request is waiting for your decision.',
        createdAt: hoursAgo(3),
        read: false,
        workItemId: 'wi-fe-118',
      },
      {
        id: 'ntf-5',
        kind: 'system',
        title: 'Jira sync completed',
        body: 'Projects APLIFYAI, INFRA and FE synced. 8 work items mirrored.',
        createdAt: hoursAgo(10),
        read: true,
      },
    ],
    boards: [],
    attachmentCounter: 0,
    onboardingByTenant: {},
    mcpConnectionsByTenant: {},
  };

  // Seed audit trail for the pre-seeded jobs so the log isn't empty on first load.
  emitAudit(
    store,
    { type: 'system', id: 'orchestrator' },
    'job.state.queued',
    { type: 'ai_job', id: 'job-queued-1' },
    { workItemId: 'wi-infra-222' },
    [1, 2, 3],
  );
  emitAudit(
    store,
    { type: 'system', id: 'orchestrator' },
    'job.state.queued',
    { type: 'ai_job', id: 'job-running-1' },
    { workItemId: 'wi-aplifyai-102' },
    [1, 2, 3],
  );
  emitAudit(
    store,
    { type: 'system', id: 'orchestrator' },
    'job.state.sanitizing',
    { type: 'ai_job', id: 'job-running-1' },
    { workItemId: 'wi-aplifyai-102', piiRedactions: 0, piiBlocks: [] },
    [1, 2, 3, 5],
  );
  emitAudit(
    store,
    { type: 'system', id: 'orchestrator' },
    'job.state.running',
    { type: 'ai_job', id: 'job-running-1' },
    { workItemId: 'wi-aplifyai-102', model: 'gpt-4o', cloud: 'azure/eastus' },
    [1, 2, 3, 4, 5],
  );

  return store;
}
