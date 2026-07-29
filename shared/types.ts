/**
 * Shared contracts for OffshoreHelper.
 * Source of truth: docs/SCHEMA_SKETCH.md — keep in sync; update the doc if these change.
 * Used by the single backend (`backend/`) and both clients (`web/`, `mobile/`).
 */

// ---------------------------------------------------------------------------
// Enums / unions
// ---------------------------------------------------------------------------

export type BoardType = 'jira';

export type AiStatus =
  | 'none'
  | 'queued'
  | 'running'
  | 'ready_for_human'
  | 'blocked_pii'
  | 'failed'
  | 'cancelled';

export type AiJobState =
  | 'queued'
  | 'sanitizing'
  | 'enriching_mcp'
  | 'running'
  | 'packaging'
  | 'attaching'
  | 'ready_for_human'
  | 'blocked_pii'
  | 'failed'
  | 'cancelled';

export type SecurityLevel = 'standard' | 'elevated' | 'enterprise' | 'custom';

export type PiiMode = 'redact' | 'block' | 'hash' | 'allow';

export type PiiCategory = 'email' | 'phone' | 'ssn' | 'credit_card' | 'customer_name';

export type ArtifactKind = 'summary' | 'patch' | 'test_stub' | 'note' | 'other';

export type ActorType = 'user' | 'system' | 'manager_mobile';

export type CloudProvider = 'aws' | 'azure' | 'gcp' | 'private';

export type PolicyScope = 'org' | 'project' | 'ticket';

export type BudgetExhaustion = 'block' | 'notify';

// ---------------------------------------------------------------------------
// WorkItem
// ---------------------------------------------------------------------------

export interface BoardRef {
  type: BoardType;
  projectId: string;
  issueKey: string;
  issueId: string;
}

export interface WorkItem {
  id: string;
  tenantId: string;
  board: BoardRef;
  title: string;
  status: string;
  assigneeExternalId: string | null;
  labels: string[];
  aiFirst: boolean;
  targetCompletionPercent: number;
  aiStatus: AiStatus;
  lastAiJobId: string | null;
  /** Ticket body fetched from the board (may contain PII — never send raw to a model). */
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Policy
// ---------------------------------------------------------------------------

export interface ModelRef {
  provider: string;
  modelId: string;
  endpoint?: string;
}

export interface CloudPolicy {
  provider: CloudProvider;
  mode: 'public_managed' | 'private_vpc' | 'customer_cloud';
  region: string;
}

export interface PlatformPolicy {
  runtime: string;
  codeOverrideMode: 'forbidden' | 'allowed_with_audit' | 'allowed';
}

export interface TokenBudget {
  maxTotalTokens: number;
  maxCostUsd?: number;
  onExhaustion: BudgetExhaustion;
}

export interface McpAllowlistEntry {
  server: string;
  tools: string[];
}

export interface PolicyLocks {
  models: boolean;
  securityMin: boolean;
  cloud: boolean;
}

export interface Policy {
  id: string;
  tenantId: string;
  scope: PolicyScope;
  securityLevel: SecurityLevel;
  pii: Record<PiiCategory, PiiMode>;
  cloud: CloudPolicy;
  model: ModelRef;
  platform: PlatformPolicy;
  tokenBudget: TokenBudget;
  mcpAllowlist: McpAllowlistEntry[];
  aiFirstDefault: boolean;
  targetCompletionPercentDefault: number;
  locks: PolicyLocks;
}

// ---------------------------------------------------------------------------
// AiJob / Artifact
// ---------------------------------------------------------------------------

export interface TokenUsage {
  input: number;
  output: number;
  total: number;
}

export interface PiiReport {
  redactions: number;
  /** Categories that triggered a block — never raw PII. */
  blocks: string[];
}

export interface Artifact {
  id: string;
  aiJobId: string;
  kind: ArtifactKind;
  storage: { provider: string; uri: string };
  checksum: string;
  boardAttachmentId: string | null;
  /** Short sanitized preview for UIs. */
  preview: string;
}

export interface CloudExecution {
  provider: CloudProvider;
  mode: string;
  region: string;
}

export interface AiJob {
  id: string;
  workItemId: string;
  tenantId: string;
  state: AiJobState;
  model: ModelRef;
  cloudExecution: CloudExecution;
  tokenUsage: TokenUsage;
  artifacts: Artifact[];
  piiReport: PiiReport;
  error: string | null;
  createdAt: string;
  finishedAt: string | null;
}

// ---------------------------------------------------------------------------
// AuditEvent
// ---------------------------------------------------------------------------

export interface AuditActor {
  type: ActorType;
  id: string;
}

export interface AuditResource {
  type: string;
  id: string;
}

export interface AuditEvent {
  id: string;
  tenantId: string;
  actor: AuditActor;
  action: string;
  resource: AuditResource;
  /** Security layer ids (1–6) applied during the action. */
  securityLayersApplied: number[];
  /** Never store secrets or raw PII. */
  metadata: Record<string, unknown>;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// API-facing DTOs (not in SCHEMA_SKETCH — client convenience views)
// ---------------------------------------------------------------------------

export interface TriageRequest {
  aiFirst: boolean;
  targetCompletionPercent?: number;
}

export interface TriageResponse {
  workItem: WorkItem;
  job: AiJob | null;
}

export interface DashboardStats {
  activeJobs: number;
  queuedJobs: number;
  readyForHuman: number;
  piiBlocks24h: number;
  piiRedactions24h: number;
  tokenUsageToday: TokenUsage;
  tokenBudget: number;
  tokenBudgetUsedPercent: number;
}

export type ApprovalRisk = 'high' | 'medium' | 'low';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface ApprovalItem {
  id: string;
  workItemId: string;
  title: string;
  reason: string;
  risk: ApprovalRisk;
  status: ApprovalStatus;
  requestedAt: string;
}

export type NotificationKind = 'ai_ready' | 'pii_block' | 'approval' | 'system' | 'security';

export interface NotificationItem {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  workItemId?: string;
}

export interface BoardHealth {
  projectId: string;
  issuePrefix: string;
  name: string;
  state: 'healthy' | 'syncing' | 'error' | 'queued';
  lastSyncAt: string;
  activeIssues: number;
  aiReadiness: 'optimal' | 'evaluating' | 'partial' | 'blocked';
}
