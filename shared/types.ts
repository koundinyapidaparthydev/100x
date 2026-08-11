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
  /**
   * `null` = org-wide base row (budgets, AI defaults, locks, security).
   * Non-null = per-environment row (PII, cloud, model, platform, MCP allowlist).
   */
  environmentId: string | null;
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

// ---------------------------------------------------------------------------
// Solutions / custom models / skills (learning layer)
// Source: docs/ai/SOLUTIONS.md, docs/ai/MODELS_AND_SKILLS.md
// ---------------------------------------------------------------------------

/** Ordered turn inside a call set — content must already be PII-cleared. */
export interface SolutionCallTurn {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  at?: string;
}

/**
 * In-flight learning candidate for one work item run.
 * Becomes a Solution only after approve + merge + promote.
 */
export type CallSetStatus = 'open' | 'approved' | 'merged' | 'promoted' | 'rejected';

export interface SolutionCallSet {
  id: string;
  tenantId: string;
  workItemId: string;
  aiJobId: string | null;
  /** Sanitized input context (ticket / thread). */
  inputSummary: string;
  /** Human-reviewed solution narrative / accepted draft. */
  solutionSummary: string;
  turns: SolutionCallTurn[];
  artifactIds: string[];
  approvalId: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  /** MR/PR URL, commit SHA, or explicit no-code ship marker. */
  mergeRef: string | null;
  mergedAt: string | null;
  status: CallSetStatus;
  /** Hint used when promoting into skill categories. */
  categoryHint: string | null;
  /** Set once promote succeeds. */
  solutionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type SolutionStatus = 'active' | 'archived' | 'superseded';

/** Immutable training record — approved + merged call set snapshot. */
export interface Solution {
  id: string;
  tenantId: string;
  callSetId: string;
  workItemId: string;
  category: string;
  inputSummary: string;
  solutionSummary: string;
  turns: SolutionCallTurn[];
  artifactIds: string[];
  mergeRef: string;
  mergedAt: string;
  approvedBy: string;
  approvedAt: string;
  status: SolutionStatus;
  usedByModelIds: string[];
  usedBySkillIds: string[];
  createdAt: string;
  updatedAt: string;
}

export type CustomModelStatus =
  | 'collecting'
  | 'queued'
  | 'training'
  | 'ready'
  | 'failed'
  | 'archived';

export interface CustomModel {
  id: string;
  tenantId: string;
  name: string;
  status: CustomModelStatus;
  solutionIds: string[];
  /** Default 0.9 — new tasks must match at least this closely to prefer the custom model. */
  matchThreshold: number;
  baseProvider: string;
  baseModelId: string;
  artifactUri: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export type SkillKitTarget = 'cursor' | 'claude_code' | 'codex' | 'chatgpt' | 'custom';
export type SkillPackStatus = 'draft' | 'review' | 'published' | 'archived';

export interface SkillPack {
  id: string;
  tenantId: string;
  name: string;
  category: string;
  status: SkillPackStatus;
  solutionIds: string[];
  targetKits: SkillKitTarget[];
  /** Sanitized playbook / skill body. */
  instructions: string;
  publishedAt: string | null;
  publishedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCallSetRequest {
  workItemId: string;
  inputSummary: string;
  solutionSummary: string;
  turns?: SolutionCallTurn[];
  artifactIds?: string[];
  aiJobId?: string | null;
  categoryHint?: string | null;
  approvalId?: string | null;
}

export interface ApproveCallSetRequest {
  approvedBy?: string;
}

export interface MergeCallSetRequest {
  mergeRef: string;
}

export interface CreateCustomModelRequest {
  name: string;
  baseProvider?: string;
  baseModelId?: string;
  matchThreshold?: number;
  solutionIds?: string[];
}

export interface LinkSolutionsRequest {
  solutionIds: string[];
}

export interface CreateSkillPackRequest {
  name: string;
  category: string;
  instructions?: string;
  targetKits?: SkillKitTarget[];
  solutionIds?: string[];
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
// Auth (H1) — custom roles + platform / MCP rule grants
// ---------------------------------------------------------------------------

/** Non-MCP console/ops capabilities selectable when composing a custom role. */
export type PlatformCapability =
  | 'identity.read'
  | 'identity.manage'
  | 'invites.manage'
  | 'groups.delete'
  | 'environments.manage'
  | 'boards.connect'
  | 'work_items.triage'
  | 'approvals.read'
  | 'approvals.decide'
  | 'policies.manage'
  | 'mcp.connect'
  | 'notifications.manage'
  | 'solutions.manage'
  | 'learning.manage';

export const PLATFORM_CAPABILITIES: PlatformCapability[] = [
  'identity.read',
  'identity.manage',
  'invites.manage',
  'groups.delete',
  'environments.manage',
  'boards.connect',
  'work_items.triage',
  'approvals.read',
  'approvals.decide',
  'policies.manage',
  'mcp.connect',
  'notifications.manage',
  'solutions.manage',
  'learning.manage',
];

export type RoleSubject = 'user';

/** MCP provider access grant — level intersects with the tenant connection level. */
export type McpAccessRoleRule = {
  kind: 'mcp_access';
  serverId: string;
  permissionLevel: 'read' | 'write' | 'admin';
};

/** Platform capability grant for console/API gates. */
export type PlatformRoleRule = {
  kind: 'platform';
  capability: PlatformCapability;
};

export type RoleRule = McpAccessRoleRule | PlatformRoleRule;

/** Tenant-defined role. Empty by default; composed from rule kinds (not built-in templates). */
export interface CustomRole {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  subject: RoleSubject;
  rules: RoleRule[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomRoleRequest {
  name: string;
  description?: string;
  rules?: RoleRule[];
}

export interface UpdateCustomRoleRequest {
  name?: string;
  description?: string;
  rules?: RoleRule[];
}

export interface AuthUser {
  id: string;
  displayName: string;
  email: string;
  /** Assigned custom role id, or null when owner-only / unassigned. */
  roleId: string | null;
  tenantId: string;
  surface: 'web' | 'mobile';
  /** How this session was minted — demo seats vs federated IdP. */
  authProvider?: 'demo' | FederatedAuthProvider;
  /** Company / workspace domain captured after Google signup (e.g. acme.com). */
  companyDomain?: string;
  /** Additional emails linked to this identity (work email ≠ Google email). */
  linkedEmails?: string[];
  /** True when this user created the workspace (owner path). Full platform + MCP bypass. */
  isWorkspaceOwner?: boolean;
  /** False until the post-Google company / primary-account gate is completed. */
  workspaceSetupComplete?: boolean;
  /** Effective platform capabilities (owner = all). Populated on /auth/me enrichment. */
  platformCapabilities?: PlatformCapability[];
}

export interface AuthSession {
  token: string;
  user: AuthUser;
  expiresAt: string;
}

export interface LoginRequest {
  /** Demo identity: owner|root|member|engineer (or email of a seeded user). Alias: founder → owner. */
  identity: string;
  surface?: 'web' | 'mobile';
}

export type WorkspaceInviteStatus = 'pending' | 'accepted' | 'revoked';

export interface WorkspaceInvite {
  id: string;
  tenantId: string;
  email: string;
  /** Custom role id granted on accept. */
  roleId: string;
  invitedByUserId: string;
  invitedByEmail: string;
  status: WorkspaceInviteStatus;
  createdAt: string;
  updatedAt: string;
  acceptedAt: string | null;
  acceptedByUserId: string | null;
  /** Last time an invite email was sent (SendGrid or stub outbox). */
  lastEmailAt: string | null;
  /** Human-readable email body preview (also stored when SendGrid sends). */
  lastEmailPreview: string | null;
}

export interface CreateInviteRequest {
  email: string;
  roleId: string;
}

export type InviteEmailChannel = 'sendgrid' | 'stub';

export interface CreateInviteResponse {
  invite: WorkspaceInvite;
  emailDelivery: {
    sent: boolean;
    channel: InviteEmailChannel;
    preview: string;
    /** SendGrid x-message-id when channel is sendgrid. */
    messageId?: string | null;
  };
}

export interface ListInvitesResponse {
  invites: WorkspaceInvite[];
}

/**
 * Per-environment membership for a workspace user.
 * Permissions come from `roleId` (CustomRole) for that environment; optional
 * inline `rules` can extend later without a role.
 */
export interface UserEnvironmentGrant {
  userId: string;
  environmentId: string;
  roleId: string | null;
  rules?: RoleRule[];
}

/** Persisted workspace member (federated + demo), keyed under usersByTenant. */
export interface TenantUser {
  id: string;
  tenantId: string;
  email: string;
  displayName: string;
  roleId: string | null;
  linkedEmails: string[];
  companyDomain: string | null;
  isWorkspaceOwner: boolean;
  workspaceSetupComplete: boolean;
  groupIds: string[];
  /** Summary of env memberships (populated on list responses). */
  environmentGrants?: UserEnvironmentGrant[];
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

export interface UpdateUserEnvironmentGrantsRequest {
  grants: Array<{
    environmentId: string;
    roleId: string | null;
    rules?: RoleRule[];
  }>;
}

export interface UserEnvironmentGrantsResponse {
  userId: string;
  grants: UserEnvironmentGrant[];
}

export interface IdentityGroup {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  /** Custom role ids attached to the group (display / assignment helpers). */
  roleIds: string[];
  memberIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceSetupRequest {
  isPrimaryGoogleAccount: boolean;
  companyDomain?: string;
  companyWebsite?: string;
  workEmail?: string;
  belongsToParentCompany: boolean;
  parentCompanyDomain?: string;
}

export interface WorkspaceSetupResponse {
  user: AuthUser;
  session: AuthSession;
}

export interface ListTenantUsersResponse {
  users: TenantUser[];
}

export interface UpdateTenantUserRequest {
  roleId?: string | null;
  linkedEmails?: string[];
  groupIds?: string[];
}

export interface ListIdentityGroupsResponse {
  groups: IdentityGroup[];
}

export interface CreateIdentityGroupRequest {
  name: string;
  description?: string;
  roleIds?: string[];
  memberIds?: string[];
}

export interface UpdateIdentityGroupRequest {
  name?: string;
  description?: string;
  roleIds?: string[];
  memberIds?: string[];
}

/** Deployment / release environment within a workspace (UI + persistence MVP). */
export type WorkspaceEnvironment = {
  id: string;
  tenantId: string;
  /** Slug: prod | stage | dev | custom */
  key: 'prod' | 'stage' | 'dev' | string;
  name: string;
  createdAt: string;
};

export type WorkspaceEnvironmentState = {
  environments: WorkspaceEnvironment[];
  activeEnvironmentId: string;
};

export interface CreateEnvironmentRequest {
  key: string;
  name: string;
}

export interface SetActiveEnvironmentRequest {
  environmentId: string;
}

export interface EnsureEnvironmentsRequest {
  /** Keys to create when the workspace has none yet. At least one required. */
  keys: string[];
}

/** Per-user platform access controls (sandbox stubs until WebAuthn/IdP wired). */
export interface RegisteredPasskey {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface PlatformAccessKey {
  id: string;
  name: string;
  /** Public prefix shown in lists (e.g. apk_ab12…). */
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export interface UserSecuritySettings {
  userId: string;
  tenantId: string;
  /** User has completed (sandbox) 2FA enrollment. */
  twoFactorEnabled: boolean;
  /** Workspace preference: require 2FA for this account on next sign-in. */
  twoFactorRequired: boolean;
  passkeysEnabled: boolean;
  passkeys: RegisteredPasskey[];
  accessKeys: PlatformAccessKey[];
  updatedAt: string;
}

export interface UpdateSecuritySettingsRequest {
  twoFactorEnabled?: boolean;
  twoFactorRequired?: boolean;
  passkeysEnabled?: boolean;
}

export interface CreatePasskeyRequest {
  name: string;
}

export interface CreateAccessKeyRequest {
  name: string;
}

export interface CreateAccessKeyResponse {
  key: PlatformAccessKey;
  /** Shown once — store securely. */
  secret: string;
  settings: UserSecuritySettings;
}

export interface ListRolesResponse {
  roles: CustomRole[];
}

export interface CreateRoleResponse {
  role: CustomRole;
}

export interface UpdateRoleResponse {
  role: CustomRole;
}

export interface ConsoleServiceRecord {
  id: string;
  name: string;
  /** Product category (conversation, boards, code, …) when known. */
  category: string;
  /** MCP availability band (official_remote, community, …). */
  availability?: string;
  connected: boolean;
  permissionLevel: string | null;
  source: 'catalog' | 'mcp';
  notes?: string;
}

export interface ListConsoleServicesResponse {
  services: ConsoleServiceRecord[];
}

export type IamImportSource = 'aws_iam' | 'gcp_iam' | 'csv' | 'json';

export interface IamImportRequest {
  source: IamImportSource;
  /** Raw exported JSON/CSV text, or a short note when using a connected cloud. */
  payload?: string;
  connectedCloudAccount?: string;
}

export interface IamImportJob {
  id: string;
  tenantId: string;
  source: IamImportSource;
  status: 'queued' | 'preview' | 'completed' | 'failed';
  summary: string;
  createdAt: string;
  createdByUserId: string;
  mappedUsers: number;
  mappedGroups: number;
}

export interface IamImportResponse {
  job: IamImportJob;
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
  | 'logging'
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
  | 'datadog'
  | 'aws_cloudwatch'
  | 'splunk'
  | 'elasticsearch'
  | 'new_relic'
  | 'grafana_loki'
  | 'okta'
  | 'azure_ad'
  | 'google_workspace'
  | 'google'
  | 'apple';

/** MCP / secure-connect readiness for a catalogued service. */
export type McpConnectionStatus = 'available' | 'planned' | 'needs_secure_setup';

/** Tenant-selected capability band when connecting an MCP provider. */
export type McpPermissionLevel = 'read' | 'write' | 'admin';

/** Auth / transport readiness surfaced to the Connections UI (never includes secrets). */
export type McpAuthState = 'none' | 'oauth_required' | 'token_required' | 'ready' | 'error';

/** Live connection record for one service’s MCP server (secrets stay in credential store). */
export interface ServiceMcpConnection {
  serviceId: ServiceId;
  serverId: string;
  /**
   * Workspace environment this connection belongs to.
   * Uniqueness is (environmentId, serviceId). Legacy rows migrate onto the
   * tenant’s active/default (prod) environment.
   */
  environmentId: string;
  status: 'connected' | 'pending' | 'error' | 'disconnected';
  /**
   * Tool gating band at connect time. Product axis is the user’s env role ∩
   * this level; owners typically connect at `admin`.
   */
  permissionLevel: McpPermissionLevel;
  /** Tool names granted at the selected permission level. */
  grantedTools: string[];
  connectedAt: string | null;
  updatedAt: string;
  /** Last error message if status === 'error'. */
  lastError?: string;
  /** Whether credentials + transport are ready for live remote calls. */
  live?: boolean;
  /** Explains gaps when not fully ready (oauth / token / transport). */
  authState?: McpAuthState;
}

/** Widget ids recommended on the connection-aware Home. */
export type HomeWidgetId = 'tickets' | 'channels' | 'approvals' | 'activity';

/** Per-user Home layout preference (show/hide + order). */
export interface HomeLayoutPrefs {
  userId: string;
  tenantId: string;
  /** Ordered widget ids the user wants visible. Empty = use recommendations. */
  widgets: HomeWidgetId[];
  updatedAt: string;
}

export interface UpdateHomeLayoutRequest {
  widgets: HomeWidgetId[];
}

/** Stored OAuth tokens for an MCP provider family (never returned to clients). */
export interface TenantMcpOAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
}

/** IAM / cloud-role identifiers (secrets stay in env / workload identity). */
export interface TenantMcpIamCredentials {
  /** AWS role ARN to assume for AWS / CloudWatch MCP. */
  roleArn?: string;
  /** Azure subscription id. */
  subscriptionId?: string;
  /** Azure AD tenant id. */
  azureTenantId?: string;
  /** GCP project id. */
  projectId?: string;
  /** Optional service-principal / client id (secret via env). */
  clientId?: string;
}

/**
 * Per-tenant MCP secrets — never returned on GET /mcp/connections.
 * Prefer tokensByServiceId for PAT / API keys; keep github/atlassian for compat.
 */
export interface TenantMcpCredentials {
  atlassian?: TenantMcpOAuthTokens;
  /** @deprecated Prefer tokensByServiceId.github — still read/written for compat. */
  github?: {
    token: string;
  };
  /** Bearer / PAT / API key by service id (Notion, Linear, logging, ADO, …). */
  tokensByServiceId?: Partial<Record<ServiceId, { token: string }>>;
  /** OAuth access tokens keyed by provider family (slack, gitlab, google, microsoft, linear, …). */
  oauthByProvider?: Partial<Record<string, TenantMcpOAuthTokens>>;
  /** Cloud IAM / role linkage by service id. */
  iamByServiceId?: Partial<Record<ServiceId, TenantMcpIamCredentials>>;
}

export type McpConnectErrorCode = 'oauth_required' | 'token_required' | 'transport_unavailable';

export interface McpConnectErrorBody {
  error: string;
  code: McpConnectErrorCode;
  authorizePath?: string;
}

export interface McpConnectRequest {
  /** Optional — defaults to `admin` for owner-connected services. */
  permissionLevel?: McpPermissionLevel;
}

export interface McpConnectionsResponse {
  connections: ServiceMcpConnection[];
  environmentId?: string;
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
  /**
   * What they want to accomplish first in the workspace (multi-select).
   * Prefer this over singular `intent`.
   */
  intents?: WorkspaceIntent[];
  /** @deprecated Prefer intents */
  intent?: WorkspaceIntent;
  teamSize?: TeamSizeBand;
  /** Work platforms / boards (multi-select). */
  primaryBoards?: ServiceId[];
  /** High-signal pains (multi-select). */
  biggestPains?: string[];
  /**
   * @deprecated No longer collected on the free path — setup readiness is implied once onboarding finishes.
   */
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
  /**
   * @deprecated No longer collected in onboarding — AI aims for full solution completion.
   * Kept optional for older profiles.
   */
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
