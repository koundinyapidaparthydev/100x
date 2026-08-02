import { getMcpProvider } from '@shared/mcpProviders';
import type { McpConnectionStatus, ServiceCategory, ServiceId } from '@shared/types';

export type ServiceCatalogEntry = {
  id: ServiceId;
  name: string;
  category: ServiceCategory;
  logo: string;
  mcpServerHint?: string;
  status: McpConnectionStatus;
  /**
   * Catalog intent before MCP connectability overrides — used for marketing
   * Available vs Coming labels so planned surfaces stay honest.
   */
  catalogStatus: McpConnectionStatus;
  /** Short note shown on Connections for secure / planned setup. */
  secureHint?: string;
  /** Identity providers are shown but not selectable for connect yet. */
  displayOnly?: boolean;
};

export const SERVICE_CATEGORY_LABELS: Record<ServiceCategory, string> = {
  conversation: 'Conversation',
  boards: 'Boards / work',
  code: 'Code',
  docs: 'Docs / knowledge',
  cloud: 'Cloud / runtime',
  identity: 'Identity (SSO)',
};

/** Free step 2: full lite stack in searchable fields (fits one laptop screen). */
export const FREE_CATALOG_CATEGORIES: ServiceCategory[] = ['boards', 'conversation', 'code'];

/** Enterprise work-platform options shown on Free step 1 (and full boards catalog). */
export const WORK_PLATFORM_IDS: ServiceId[] = [
  'jira',
  'linear',
  'azure_devops',
  'asana',
  'monday',
  'servicenow',
  'smartsheet',
  'planview',
  'github_projects',
  'gitlab_boards',
  'trello',
  'clickup',
  'wrike',
  'shortcut',
  'rally',
];

const SERVICE_CATALOG_BASE: Array<Omit<ServiceCatalogEntry, 'catalogStatus'>> = [
  // Conversation
  {
    id: 'slack',
    name: 'Slack',
    category: 'conversation',
    logo: '/brands/slack.svg',
    secureHint: 'OAuth app + channel allowlist required.',
    status: 'planned',
  },
  {
    id: 'teams',
    name: 'Microsoft Teams',
    category: 'conversation',
    logo: '/brands/teams.svg',
    secureHint: 'Microsoft Graph consent + tenant admin approval.',
    status: 'planned',
  },
  {
    id: 'outlook',
    name: 'Outlook',
    category: 'conversation',
    logo: '/brands/outlook.svg',
    status: 'planned',
    secureHint: 'Microsoft Graph mail scopes with admin consent.',
  },
  {
    id: 'gmail',
    name: 'Gmail',
    category: 'conversation',
    logo: '/brands/gmail.svg',
    status: 'planned',
    secureHint: 'Google OAuth with restricted Gmail scopes.',
  },
  {
    id: 'google_chat',
    name: 'Google Chat',
    category: 'conversation',
    logo: '/brands/google_chat.svg',
    status: 'planned',
  },
  {
    id: 'discord',
    name: 'Discord',
    category: 'conversation',
    logo: '/brands/discord.svg',
    status: 'planned',
  },
  {
    id: 'zoom_chat',
    name: 'Zoom Team Chat',
    category: 'conversation',
    logo: '/brands/zoom_chat.svg',
    status: 'planned',
  },
  {
    id: 'webex',
    name: 'Webex',
    category: 'conversation',
    logo: '/brands/webex.svg',
    status: 'planned',
  },
  {
    id: 'mattermost',
    name: 'Mattermost',
    category: 'conversation',
    logo: '/brands/mattermost.svg',
    status: 'planned',
  },
  {
    id: 'rocket_chat',
    name: 'Rocket.Chat',
    category: 'conversation',
    logo: '/brands/rocket_chat.svg',
    status: 'planned',
  },
  {
    id: 'ringcentral',
    name: 'RingCentral',
    category: 'conversation',
    logo: '/brands/ringcentral.svg',
    status: 'planned',
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    category: 'conversation',
    logo: '/brands/whatsapp.svg',
    status: 'planned',
    secureHint: 'Business API + allowlisted numbers. Coming soon.',
  },
  {
    id: 'telegram',
    name: 'Telegram',
    category: 'conversation',
    logo: '/brands/telegram.svg',
    status: 'planned',
    secureHint: 'Bot token + chat allowlist. Coming soon.',
  },

  // Boards / work platforms
  {
    id: 'jira',
    name: 'Jira',
    category: 'boards',
    logo: '/brands/jira.svg',
    status: 'available',
    secureHint: 'Connect a Jira Cloud project with an API token.',
  },
  {
    id: 'linear',
    name: 'Linear',
    category: 'boards',
    logo: '/brands/linear.svg',
    status: 'planned',
    secureHint: 'Linear OAuth + workspace API key.',
  },
  {
    id: 'azure_devops',
    name: 'Azure DevOps',
    category: 'boards',
    logo: '/brands/azure_devops.svg',
    status: 'planned',
    secureHint: 'Azure DevOps PAT scoped to work items.',
  },
  {
    id: 'asana',
    name: 'Asana',
    category: 'boards',
    logo: '/brands/asana.svg',
    status: 'planned',
  },
  {
    id: 'monday',
    name: 'Monday.com',
    category: 'boards',
    logo: '/brands/monday.svg',
    status: 'planned',
  },
  {
    id: 'servicenow',
    name: 'ServiceNow',
    category: 'boards',
    logo: '/brands/servicenow.svg',
    status: 'needs_secure_setup',
    secureHint: 'Customer instance URL + OAuth client credentials.',
  },
  {
    id: 'smartsheet',
    name: 'Smartsheet',
    category: 'boards',
    logo: '/brands/smartsheet.svg',
    status: 'planned',
  },
  {
    id: 'planview',
    name: 'Planview',
    category: 'boards',
    logo: '/brands/planview.svg',
    status: 'planned',
  },
  {
    id: 'github_projects',
    name: 'GitHub Enterprise Projects',
    category: 'boards',
    logo: '/brands/github_projects.svg',
    status: 'planned',
  },
  {
    id: 'gitlab_boards',
    name: 'GitLab Issue Boards',
    category: 'boards',
    logo: '/brands/gitlab_boards.svg',
    status: 'planned',
  },
  {
    id: 'trello',
    name: 'Trello',
    category: 'boards',
    logo: '/brands/trello.svg',
    status: 'planned',
  },
  {
    id: 'clickup',
    name: 'ClickUp',
    category: 'boards',
    logo: '/brands/clickup.svg',
    status: 'planned',
  },
  {
    id: 'wrike',
    name: 'Wrike',
    category: 'boards',
    logo: '/brands/wrike.svg',
    status: 'planned',
  },
  {
    id: 'shortcut',
    name: 'Shortcut',
    category: 'boards',
    logo: '/brands/shortcut.svg',
    status: 'planned',
  },
  {
    id: 'rally',
    name: 'Rally',
    category: 'boards',
    logo: '/brands/rally.svg',
    status: 'planned',
  },

  // Code
  {
    id: 'github',
    name: 'GitHub',
    category: 'code',
    logo: '/brands/github.svg',
    status: 'planned',
    secureHint: 'GitHub App install with least-privilege repos.',
  },
  {
    id: 'github_enterprise',
    name: 'GitHub Enterprise',
    category: 'code',
    logo: '/brands/github_enterprise.svg',
    status: 'needs_secure_setup',
    secureHint: 'GHES / GHEC org install with private networking.',
  },
  {
    id: 'gitlab',
    name: 'GitLab',
    category: 'code',
    logo: '/brands/gitlab.svg',
    status: 'planned',
    secureHint: 'GitLab OAuth or group access token.',
  },
  {
    id: 'gitlab_self_managed',
    name: 'GitLab Self-Managed',
    category: 'code',
    logo: '/brands/gitlab_self_managed.svg',
    status: 'needs_secure_setup',
    secureHint: 'Self-managed base URL + group token over private link.',
  },
  {
    id: 'bitbucket',
    name: 'Bitbucket',
    category: 'code',
    logo: '/brands/bitbucket.svg',
    status: 'planned',
  },
  {
    id: 'azure_repos',
    name: 'Azure Repos',
    category: 'code',
    logo: '/brands/azure_repos.svg',
    status: 'planned',
  },
  {
    id: 'aws_codecommit',
    name: 'AWS CodeCommit',
    category: 'code',
    logo: '/brands/aws_codecommit.svg',
    status: 'needs_secure_setup',
  },
  {
    id: 'gerrit',
    name: 'Gerrit',
    category: 'code',
    logo: '/brands/gerrit.svg',
    status: 'planned',
  },
  {
    id: 'perforce',
    name: 'Perforce Helix',
    category: 'code',
    logo: '/brands/perforce.svg',
    status: 'needs_secure_setup',
  },
  {
    id: 'gitea',
    name: 'Gitea',
    category: 'code',
    logo: '/brands/gitea.svg',
    status: 'planned',
  },

  // Docs
  {
    id: 'confluence',
    name: 'Confluence',
    category: 'docs',
    logo: '/brands/confluence.svg',
    status: 'planned',
    secureHint: 'Atlassian OAuth with space-scoped read.',
  },
  {
    id: 'notion',
    name: 'Notion',
    category: 'docs',
    logo: '/brands/notion.svg',
    status: 'planned',
    secureHint: 'Notion integration + page share grants.',
  },
  {
    id: 'google_drive',
    name: 'Google Drive',
    category: 'docs',
    logo: '/brands/google_drive.svg',
    status: 'needs_secure_setup',
    secureHint: 'Google Workspace OAuth with Drive file scope.',
  },
  {
    id: 'sharepoint',
    name: 'SharePoint',
    category: 'docs',
    logo: '/brands/sharepoint.svg',
    status: 'needs_secure_setup',
    secureHint: 'Microsoft Graph Sites.Selected + admin consent.',
  },

  // Cloud / runtime
  {
    id: 'aws',
    name: 'AWS',
    category: 'cloud',
    logo: '/brands/aws.svg',
    status: 'needs_secure_setup',
    secureHint: 'Cross-account IAM role + private networking.',
  },
  {
    id: 'gcp',
    name: 'GCP',
    category: 'cloud',
    logo: '/brands/gcp.svg',
    status: 'needs_secure_setup',
    secureHint: 'Workload identity federation + VPC controls.',
  },
  {
    id: 'azure',
    name: 'Azure',
    category: 'cloud',
    logo: '/brands/azure.svg',
    status: 'needs_secure_setup',
    secureHint: 'Managed identity in customer subscription / private VPC.',
  },
  {
    id: 'nvidia',
    name: 'NVIDIA',
    category: 'cloud',
    logo: '/brands/nvidia.svg',
    status: 'needs_secure_setup',
    secureHint: 'DGX Cloud / NGC private endpoints + customer GPU runners.',
  },
  {
    id: 'cursor',
    name: 'Cursor / agent kits',
    category: 'cloud',
    logo: '/brands/cursor.svg',
    status: 'planned',
    secureHint: 'Agent kit allowlist + repo sandbox policy.',
  },
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    category: 'cloud',
    logo: '/brands/chatgpt.svg',
    status: 'planned',
    secureHint: 'Agent client connect for ticket stats and cleared context. Coming soon.',
  },
  {
    id: 'codex',
    name: 'Codex',
    category: 'cloud',
    logo: '/brands/codex.svg',
    status: 'planned',
    secureHint: 'Agent client for cleared ticket context after connect. Coming soon.',
  },
  {
    id: 'claude_code',
    name: 'Claude Code',
    category: 'cloud',
    logo: '/brands/claude_code.svg',
    status: 'planned',
    secureHint: 'Agent client for cleared ticket context after connect. Coming soon.',
  },

  // Identity
  {
    id: 'okta',
    name: 'Okta',
    category: 'identity',
    logo: '/brands/okta.svg',
    status: 'available',
    displayOnly: true,
    secureHint: 'Configure OKTA_* on the backend to enable Continue with Okta (OIDC).',
  },
  {
    id: 'azure_ad',
    name: 'Microsoft Entra ID',
    category: 'identity',
    logo: '/brands/azure_ad.svg',
    status: 'available',
    displayOnly: true,
    secureHint: 'Configure ENTRA_* on the backend to enable Continue with Microsoft (OIDC).',
  },
  {
    id: 'google_workspace',
    name: 'Google Workspace',
    category: 'identity',
    logo: '/brands/google_workspace.svg',
    status: 'available',
    displayOnly: true,
    secureHint:
      'Configure GOOGLE_WORKSPACE_* (or shared GOOGLE_*) and optional GOOGLE_WORKSPACE_HD for domain SSO.',
  },
  {
    id: 'google',
    name: 'Google',
    category: 'identity',
    logo: '/brands/google_workspace.svg',
    status: 'available',
    displayOnly: true,
    secureHint: 'Configure GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET for Continue with Google.',
  },
  {
    id: 'apple',
    name: 'Apple',
    category: 'identity',
    logo: '/brands/apple.svg',
    status: 'available',
    displayOnly: true,
    secureHint:
      'Configure APPLE_CLIENT_ID, APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY for Continue with Apple.',
  },
];

/** Sync mcpServerHint + connect readiness from the shared MCP provider registry. */
export const SERVICE_CATALOG: ServiceCatalogEntry[] = SERVICE_CATALOG_BASE.map((entry) => {
  const catalogStatus = entry.status;
  const provider = getMcpProvider(entry.id);
  if (!provider) return { ...entry, catalogStatus };
  return {
    ...entry,
    catalogStatus,
    mcpServerHint: provider.serverId,
    status: provider.connectable
      ? entry.status === 'needs_secure_setup'
        ? 'needs_secure_setup'
        : 'available'
      : entry.status,
    secureHint: entry.secureHint ?? provider.notes,
  };
});

const BY_ID = new Map(SERVICE_CATALOG.map((entry) => [entry.id, entry]));

export function getService(id: ServiceId): ServiceCatalogEntry | undefined {
  return BY_ID.get(id);
}

export function servicesForCategories(categories: ServiceCategory[]): ServiceCatalogEntry[] {
  return SERVICE_CATALOG.filter((entry) => categories.includes(entry.category));
}

export function servicesByCategory(
  categories?: ServiceCategory[],
): Array<{ category: ServiceCategory; label: string; services: ServiceCatalogEntry[] }> {
  const cats = categories ?? (Object.keys(SERVICE_CATEGORY_LABELS) as ServiceCategory[]);
  return cats.map((category) => ({
    category,
    label: SERVICE_CATEGORY_LABELS[category],
    services: SERVICE_CATALOG.filter((s) => s.category === category),
  }));
}

export function workPlatformServices(): ServiceCatalogEntry[] {
  return WORK_PLATFORM_IDS.map((id) => BY_ID.get(id)).filter(
    (entry): entry is ServiceCatalogEntry => Boolean(entry),
  );
}

export function mcpStatusLabel(status: McpConnectionStatus): string {
  switch (status) {
    case 'available':
      return 'Ready to connect';
    case 'planned':
      return 'Planned';
    case 'needs_secure_setup':
      return 'Needs secure setup';
  }
}

/** Marketing-facing Available vs Coming — uses catalog intent, not MCP connect stubs. */
export function marketingAvailability(entry: ServiceCatalogEntry): 'Available' | 'Coming' {
  return entry.catalogStatus === 'planned' ? 'Coming' : 'Available';
}

/** Spotlight IDs used on marketing connection surfaces. */
export const MARKETING_SURFACE_IDS = {
  boards: ['jira', 'linear', 'azure_devops', 'asana', 'monday', 'github_projects'] as ServiceId[],
  conversation: ['slack', 'teams', 'discord', 'whatsapp', 'telegram'] as ServiceId[],
  agents: ['cursor', 'chatgpt', 'codex', 'claude_code'] as ServiceId[],
  cloud: ['aws', 'gcp', 'azure', 'nvidia'] as ServiceId[],
} as const;

export function marketingServices(ids: readonly ServiceId[]): ServiceCatalogEntry[] {
  return ids.map((id) => BY_ID.get(id)).filter((entry): entry is ServiceCatalogEntry => Boolean(entry));
}
