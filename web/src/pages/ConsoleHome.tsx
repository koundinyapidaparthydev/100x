import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  CloudUpload,
  FolderKanban,
  KeyRound,
  Link2,
  Search,
  Shield,
  Users,
  UsersRound,
  Boxes,
} from 'lucide-react';
import { PageContainer, PageHeader } from '../components/ui';
import { cn } from '../lib/utils';

type ConsoleTile = {
  name: string;
  description: string;
  path: string;
  icon: typeof Users;
  testId: string;
  keywords: string[];
};

const TILES: ConsoleTile[] = [
  {
    name: 'Users',
    description: 'Invite people, link emails, assign roles and groups',
    path: '/console/users',
    icon: Users,
    testId: 'console-tile-users',
    keywords: ['users', 'people', 'invite', 'members', 'email'],
  },
  {
    name: 'Roles',
    description: 'Built-in Root, Delivery lead, Contributor, Auditor',
    path: '/console/roles',
    icon: Shield,
    testId: 'console-tile-roles',
    keywords: ['roles', 'permissions', 'rbac', 'root', 'manager'],
  },
  {
    name: 'Groups',
    description: 'Organize members and attach roles',
    path: '/console/groups',
    icon: UsersRound,
    testId: 'console-tile-groups',
    keywords: ['groups', 'teams', 'membership'],
  },
  {
    name: 'Services',
    description: 'Connected platforms and MCP catalog',
    path: '/console/services',
    icon: Boxes,
    testId: 'console-tile-services',
    keywords: ['services', 'integrations', 'mcp', 'platforms'],
  },
  {
    name: 'Projects',
    description: 'Boards and delivery workspaces',
    path: '/projects',
    icon: FolderKanban,
    testId: 'console-tile-projects',
    keywords: ['projects', 'boards', 'jira', 'work'],
  },
  {
    name: 'Connections',
    description: 'Connect cloud and work platforms',
    path: '/connections',
    icon: Link2,
    testId: 'console-tile-connections',
    keywords: ['connections', 'oauth', 'connect'],
  },
  {
    name: 'Import IAM',
    description: 'Import users and groups from AWS or GCP (stub)',
    path: '/console/iam-import',
    icon: CloudUpload,
    testId: 'console-tile-iam-import',
    keywords: ['import', 'aws', 'gcp', 'iam', 'csv'],
  },
  {
    name: 'Settings',
    description: 'Workspace settings and invites',
    path: '/admin',
    icon: KeyRound,
    testId: 'console-tile-settings',
    keywords: ['settings', 'admin', 'workspace'],
  },
];

export default function ConsoleHome() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return TILES;
    return TILES.filter(
      (tile) =>
        tile.name.toLowerCase().includes(q) ||
        tile.description.toLowerCase().includes(q) ||
        tile.keywords.some((k) => k.includes(q)),
    );
  }, [query]);

  return (
    <PageContainer width="operational">
      <PageHeader
        eyebrow="Console"
        title="Search services"
        description="Find users, roles, groups, services, projects, and connections — without dumping full lists first."
      />

      <div className="relative mx-auto w-full max-w-2xl" data-testid="console-home-search">
        <Search
          size={18}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant"
          aria-hidden="true"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && filtered[0]) {
              navigate(filtered[0].path);
            }
          }}
          placeholder="Search users, roles, groups, services, projects…"
          autoFocus
          data-testid="console-home-search-input"
          className="h-12 w-full rounded-xl border border-outline-variant bg-surface pl-11 pr-4 text-base text-on-surface outline-none placeholder:text-on-surface-variant focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        <p className="mt-2 text-center text-xs text-on-surface-variant">
          Press <kbd className="rounded border border-outline-variant px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd> anywhere for the command palette
        </p>
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {filtered.map((tile) => {
          const Icon = tile.icon;
          return (
            <Link
              key={tile.path}
              to={tile.path}
              data-testid={tile.testId}
              className={cn(
                'group flex flex-col gap-3 rounded-xl border border-outline-variant bg-surface p-4 transition-colors',
                'hover:border-primary/40 hover:bg-surface-container-low',
              )}
            >
              <span className="flex size-10 items-center justify-center rounded-lg bg-primary-container text-on-primary-container">
                <Icon size={18} aria-hidden="true" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-on-surface group-hover:text-primary">
                  {tile.name}
                </span>
                <span className="mt-1 block text-xs text-on-surface-variant">{tile.description}</span>
              </span>
            </Link>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <p className="mt-6 text-center text-sm text-on-surface-variant" data-testid="console-home-empty">
          No matches for “{query}”. Try users, roles, or projects.
        </p>
      )}
    </PageContainer>
  );
}
