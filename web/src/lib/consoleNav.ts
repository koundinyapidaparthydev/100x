import {
  Boxes,
  CloudUpload,
  FolderKanban,
  KeyRound,
  Layers,
  Link2,
  Shield,
  Users,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';

export type ConsoleSectionId = 'identity' | 'delivery' | 'integrations' | 'workspace';

export type ConsoleNavItem = {
  id: string;
  name: string;
  description: string;
  path: string;
  icon: LucideIcon;
  testId: string;
  keywords: string[];
  /** Short hint for command palette rows */
  hint: string;
  /** Console home tab grouping */
  section: ConsoleSectionId;
};

export const CONSOLE_SECTIONS: { id: ConsoleSectionId | 'overview'; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'identity', label: 'Identity' },
  { id: 'delivery', label: 'Delivery' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'workspace', label: 'Workspace' },
];

/** Primary console destinations shown in the sticky console nav strip. */
export const CONSOLE_CONTEXT_ITEMS: { name: string; path: string; testId: string; exact?: boolean }[] = [
  { name: 'Overview', path: '/console', testId: 'console-nav-overview', exact: true },
  { name: 'Users', path: '/console/users', testId: 'console-nav-users' },
  { name: 'Roles', path: '/console/roles', testId: 'console-nav-roles' },
  { name: 'Groups', path: '/console/groups', testId: 'console-nav-groups' },
  { name: 'Services', path: '/console/services', testId: 'console-nav-services' },
  { name: 'Environments', path: '/console/environments', testId: 'console-nav-environments' },
];

/** Console services shown as tiles and in the top search / ⌘K palette. */
export const CONSOLE_NAV_ITEMS: ConsoleNavItem[] = [
  {
    id: 'users',
    name: 'Users',
    description: 'Invite people, link emails, assign roles and groups',
    path: '/console/users',
    icon: Users,
    testId: 'console-tile-users',
    keywords: ['users', 'people', 'invite', 'members', 'email'],
    hint: 'Identity',
    section: 'identity',
  },
  {
    id: 'roles',
    name: 'Roles',
    description: 'Custom roles from MCP and platform capabilities',
    path: '/console/roles',
    icon: Shield,
    testId: 'console-tile-roles',
    keywords: ['roles', 'permissions', 'rbac', 'root', 'manager'],
    hint: 'Identity',
    section: 'identity',
  },
  {
    id: 'groups',
    name: 'Groups',
    description: 'Organize members and attach roles',
    path: '/console/groups',
    icon: UsersRound,
    testId: 'console-tile-groups',
    keywords: ['groups', 'teams', 'membership'],
    hint: 'Identity',
    section: 'identity',
  },
  {
    id: 'services',
    name: 'Services',
    description: 'Connected platforms and MCP catalog',
    path: '/console/services',
    icon: Boxes,
    testId: 'console-tile-services',
    keywords: ['services', 'integrations', 'mcp', 'platforms'],
    hint: 'Catalog',
    section: 'integrations',
  },
  {
    id: 'projects',
    name: 'Projects',
    description: 'Boards and delivery workspaces',
    path: '/projects',
    icon: FolderKanban,
    testId: 'console-tile-projects',
    keywords: ['projects', 'boards', 'jira', 'work'],
    hint: 'Delivery',
    section: 'delivery',
  },
  {
    id: 'connections',
    name: 'Connections',
    description: 'Connect cloud and work platforms',
    path: '/connections',
    icon: Link2,
    testId: 'console-tile-connections',
    keywords: ['connections', 'oauth', 'connect'],
    hint: 'Integrations',
    section: 'integrations',
  },
  {
    id: 'iam-import',
    name: 'Import IAM',
    description: 'Import users and groups from AWS or GCP',
    path: '/console/iam-import',
    icon: CloudUpload,
    testId: 'console-tile-iam-import',
    keywords: ['import', 'aws', 'gcp', 'iam', 'csv'],
    hint: 'AWS / GCP',
    section: 'identity',
  },
  {
    id: 'environments',
    name: 'Environments',
    description: 'Production, Staging, Development, and custom levels',
    path: '/console/environments',
    icon: Layers,
    testId: 'console-tile-environments',
    keywords: ['environment', 'prod', 'stage', 'dev', 'qa', 'production'],
    hint: 'Workspace',
    section: 'workspace',
  },
  {
    id: 'settings',
    name: 'Security',
    description: '2FA, passkeys, and platform access keys',
    path: '/admin',
    icon: KeyRound,
    testId: 'console-tile-settings',
    keywords: ['settings', 'admin', 'security', '2fa', 'passkey', 'api key'],
    hint: 'Account',
    section: 'workspace',
  },
];

export const CONSOLE_SEARCH_PLACEHOLDER =
  'Search users, roles, groups, services, projects…';

export const OPEN_COMMAND_PALETTE_EVENT = '100x:open-command-palette';

export function openCommandPalette(seedQuery = '') {
  window.dispatchEvent(
    new CustomEvent(OPEN_COMMAND_PALETTE_EVENT, { detail: { query: seedQuery } }),
  );
}
