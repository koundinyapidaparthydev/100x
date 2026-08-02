/**
 * Shared contracts for AplifyAI.
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

/**
 * How recognized values are cleared when mode is `redact`.
 * - placeholder: `[EMAIL_1]`, `[PHONE_1]`, …
 * - fixed: replace with `fixedReplacement` (e.g. a specific cleared email)
 * - mask_keep_last: keep last N digits (phone / card / SSN)
 * - mask_keep_domain: `***@domain.tld` for emails
 */
export type PiiRedactionStyle = 'placeholder' | 'fixed' | 'mask_keep_last' | 'mask_keep_domain';

/** Per-category PII/PCI handling — mode plus optional clearing customization. */
export interface PiiCategoryRule {
  mode: PiiMode;
  /** Used when mode is `redact`. Defaults to category-specific style. */
  style?: PiiRedactionStyle;
  /** Replacement when style is `fixed` (e.g. `user@cleared.invalid`). */
  fixedReplacement?: string;
  /** Digits retained when style is `mask_keep_last`. Default 4. */
  keepLastDigits?: number;
}

export type ArtifactKind = 'summary' | 'patch' | 'test_stub' | 'note' | 'other';

export type ActorType = 'user' | 'system' | 'manager_mobile';

/** Where AI / agent compute is intended to run (policy + job records). */
export type CloudProvider = 'aws' | 'azure' | 'gcp' | 'nvidia' | 'private' | 'custom';

/** First-class private / customer cloud platforms offered in settings & onboarding. */
export const PRIVATE_CLOUD_PROVIDERS: CloudProvider[] = [
  'aws',
  'azure',
  'gcp',
  'nvidia',
  'private',
  'custom',
];

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

export type TriageDecision = 'ai_first' | 'human_first';

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
  /**
   * Set when a manager completes triage. Null = still in the swipe queue.
   * Human-first tickets keep aiStatus 'none' but leave the queue permanently.
   */
  lastTriageDecision: TriageDecision | null;
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

/**
 * Where AI compute runs (account source):
 * - `customer_cloud` — connected customer AWS/Azure/GCP/NVIDIA accounts (use their account)
 * - `public_managed` — AplifyAI private / managed cloud (our plane)
 * - `private_vpc` — bring-your-own-cloud; customer picks platform and connects it
 */
export interface CloudPolicy {
  provider: CloudProvider;
  mode: 'public_managed' | 'private_vpc' | 'customer_cloud';
  region: string;
  /**
   * Free-text platform name when `provider` is `custom`
   * (e.g. "Oracle Cloud", "on-prem Kubernetes", "CoreWeave").
   */
  customLabel?: string;
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
  pii: Record<PiiCategory, PiiCategoryRule>;
  /** End-customer names matched as PII (word-boundary). Empty = name detector off. */
  customerNames: string[];
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
  /** Full sanitized draft body (sandbox stores inline; production may hydrate from storage). */
  content: string;
}

export interface CloudExecution {
  provider: CloudProvider;
  mode: string;
  region: string;
  customLabel?: string;
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
  /** Whether this project was explicitly connected (sandbox registry). */
  connected: boolean;
}

/** Partial policy update — only provided fields are merged. */
export type PolicyUpdate = Partial<
  Pick<
    Policy,
    | 'securityLevel'
    | 'pii'
    | 'customerNames'
    | 'cloud'
    | 'model'
    | 'platform'
    | 'tokenBudget'
    | 'mcpAllowlist'
    | 'aiFirstDefault'
    | 'targetCompletionPercentDefault'
    | 'locks'
  >
>;

export interface BoardConnectRequest {
  projectId: string;
  name: string;
  /** Optional seed issues created on connect (sandbox only). */
  seedIssues?: Array<{
    title: string;
    description?: string;
    priority?: WorkItem['priority'];
  }>;
}

export interface WorkItemAssigneeUpdate {
  assigneeExternalId: string | null;
}

export interface AccessRequestBody {
  reason?: string;
}

// ---------------------------------------------------------------------------
// Auth (H1)
// ---------------------------------------------------------------------------

export type UserRole = 'founder' | 'manager' | 'engineer' | 'auditor';

export interface AuthUser {
  id: string;
  displayName: string;
  email: string;
  role: UserRole;
  tenantId: string;
  surface: 'web' | 'mobile';
}

export interface AuthSession {
  token: string;
  user: AuthUser;
  expiresAt: string;
}

export interface LoginRequest {
  /** Demo identity: founder | manager | engineer | auditor (or email of a seeded user). */
  identity: string;
  surface?: 'web' | 'mobile';
}

export interface LoginResponse {
  session: AuthSession;
}

/** Federated identity providers (enterprise SSO + social). */
export type FederatedAuthProvider =
  | 'okta'
  | 'entra'
  | 'google_workspace'
  | 'google'
  | 'apple';

export interface FederatedProviderStatus {
  enabled: boolean;
  provider: FederatedAuthProvider;
  label: string;
  category: 'enterprise_sso' | 'social';
  issuer?: string;
  clientId?: string;
  redirectUri?: string;
}

export interface FederatedProvidersStatusResponse {
  providers: FederatedProviderStatus[];
}

/** @deprecated Prefer FederatedProviderStatus — kept for Okta-specific clients. */
export interface OktaStatus {
  enabled: boolean;
  issuer?: string;
  clientId?: string;
  redirectUri?: string;
}

export interface FederatedExchangeRequest {
  exchange: string;
}

export interface FederatedExchangeResponse {
  session: AuthSession;
  intent: 'login' | 'signup';
  provider: FederatedAuthProvider;
}

/** @deprecated Prefer FederatedExchangeRequest */
export type OktaExchangeRequest = FederatedExchangeRequest;

/** @deprecated Prefer FederatedExchangeResponse */
export interface OktaExchangeResponse {
  session: AuthSession;
  intent: 'login' | 'signup';
  provider?: FederatedAuthProvider;
}

// ---------------------------------------------------------------------------
// Onboarding (create-application wizard)
// ---------------------------------------------------------------------------

export type OnboardingPlan = 'free' | 'enterprise';

export type ServiceCategory =
  | 'conversation'
  | 'boards'
  | 'code'
  | 'docs'
  | 'cloud'
  | 'identity';

export type ServiceId =
  | 'slack'
  | 'teams'
  | 'outlook'
  | 'gmail'
  | 'discord'
  | 'zoom_chat'
  | 'google_chat'
  | 'webex'
  | 'mattermost'
  | 'rocket_chat'
  | 'ringcentral'
  | 'whatsapp'
  | 'telegram'
  | 'jira'
  | 'linear'
  | 'azure_devops'
  | 'asana'
  | 'monday'
  | 'servicenow'
  | 'smartsheet'
  | 'planview'
  | 'github_projects'
  | 'gitlab_boards'
  | 'trello'
  | 'clickup'
  | 'wrike'
  | 'shortcut'
  | 'rally'
  | 'github'
  | 'github_enterprise'
  | 'gitlab'
  | 'gitlab_self_managed'
  | 'bitbucket'
  | 'azure_repos'
  | 'aws_codecommit'
  | 'gerrit'
  | 'perforce'
  | 'gitea'
  | 'confluence'
  | 'notion'
  | 'google_drive'
  | 'sharepoint'
  | 'aws'
  | 'gcp'
  | 'azure'
  | 'nvidia'
  | 'cursor'
  | 'chatgpt'
  | 'codex'
  | 'claude_code'
  | 'okta'
  | 'azure_ad'
  | 'google_workspace'
  | 'google'
  | 'apple';

/** MCP / secure-connect readiness for a catalogued service. */
export type McpConnectionStatus = 'available' | 'planned' | 'needs_secure_setup';

/** Tenant-selected capability band when connecting an MCP provider. */
export type McpPermissionLevel = 'read' | 'write' | 'admin';

/** Live connection record for one service’s MCP server (no secrets stored in demo). */
export interface ServiceMcpConnection {
  serviceId: ServiceId;
  serverId: string;
  status: 'connected' | 'pending' | 'error' | 'disconnected';
  permissionLevel: McpPermissionLevel;
  /** Tool names granted at the selected permission level. */
  grantedTools: string[];
  connectedAt: string | null;
  updatedAt: string;
  /** Last error message if status === 'error'. */
  lastError?: string;
}

export interface McpConnectRequest {
  permissionLevel: McpPermissionLevel;
}

export interface McpConnectionsResponse {
  connections: ServiceMcpConnection[];
}

export type TeamSizeBand = '1-5' | '6-20' | '21-100' | '100+';
export type DeliveryUrgency = 'this_week' | 'this_month' | 'this_quarter' | 'exploring';
export type WorkspaceIntent = 'triage' | 'connect_tools' | 'govern_ai' | 'explore';
export type BuyerRole = 'executive' | 'delivery_lead' | 'platform' | 'security' | 'ops';
export type HumanInTheLoopPref = 'always' | 'high_risk' | 'exceptions' | 'minimal';
/**
 * Onboarding “Where AI runs” — same three modes as CloudPolicy.mode:
 * connected accounts | AplifyAI private cloud | customer BYOC.
 */
export type HostingPreference = 'private_vpc' | 'customer_cloud' | 'public_managed';
export type RuntimeModePref = 'request_based' | 'always_on';
export type CustomModelPref = 'none' | 'side_by_side' | 'trained';
export type TokenBudgetAppetite = 'conservative' | 'balanced' | 'aggressive';
export type McpAllowlistAggressiveness = 'strict' | 'balanced' | 'open';

export interface LiteOnboardingAnswers {
  /** What they want to accomplish first in the workspace. */
  intent?: WorkspaceIntent;
  teamSize?: TeamSizeBand;
  /** Work platforms / boards (multi-select). */
  primaryBoards?: ServiceId[];
  /** High-signal pains (multi-select). */
  biggestPains?: string[];
  urgency?: DeliveryUrgency;
  /** @deprecated Prefer primaryBoards */
  primaryBoard?: ServiceId | '';
  /** @deprecated Prefer biggestPains */
  biggestPain?: string;
}

export interface EnterpriseMoveAnswers {
  /** Outcomes the org is buying for (multi-select). */
  goals?: string[];
  /** Who is leading the evaluation / rollout. */
  buyerRole?: BuyerRole | '';
  currentAiUsage?: string;
  complianceNeeds?: string[];
  orgSize?: TeamSizeBand | '';
  primaryDeliveryModel?: string;
  successCriteria?: string[];
  blockers?: string[];
  timeline?: DeliveryUrgency | '';
}

export interface ExpectationsAnswers {
  /** Speed-up target multiplier, 3–100. */
  speedMultiplier?: number;
  improveAreas?: string[];
  aiCompletionTargetPercent?: number;
  humanInTheLoop?: HumanInTheLoopPref;
}

export interface RuntimeAnswers {
  /**
   * Account source: `customer_cloud` (connected accounts), `public_managed`
   * (AplifyAI private cloud), or `private_vpc` (BYOC).
   */
  hosting?: HostingPreference;
  /** Platform when using connected accounts or BYOC (ignored for AplifyAI private cloud). */
  cloudProvider?: CloudProvider;
  /** Required when cloudProvider is `custom`. */
  customCloudLabel?: string;
  runtimeMode?: RuntimeModePref;
  customModel?: CustomModelPref;
  codeOverrideStance?: PlatformPolicy['codeOverrideMode'];
  tokenBudgetAppetite?: TokenBudgetAppetite;
  regions?: string[];
  mcpAllowlistAggressiveness?: McpAllowlistAggressiveness;
}

export interface OnboardingProfile {
  plan: OnboardingPlan;
  /** ISO timestamp when wizard was finished; null while in progress. */
  completedAt: string | null;
  selectedServices: ServiceId[];
  otherByCategory: Partial<Record<ServiceCategory, string>>;
  lite?: LiteOnboardingAnswers;
  enterprise?: {
    move?: EnterpriseMoveAnswers;
    expectations?: ExpectationsAnswers;
    runtime?: RuntimeAnswers;
  };
  updatedAt: string;
}

export interface OnboardingUpsertRequest {
  profile: OnboardingProfile;
}
