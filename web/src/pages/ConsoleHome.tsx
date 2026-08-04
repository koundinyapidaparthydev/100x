import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, Circle, Link2, UserPlus } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '@shared/api';
import { Button, PageContainer, PageHeader } from '../components/ui';
import {
  CONSOLE_NAV_ITEMS,
  CONSOLE_SECTIONS,
  type ConsoleNavItem,
  type ConsoleSectionId,
} from '../lib/consoleNav';
import { environmentDisplayName } from '../lib/environmentLabels';
import { cn } from '../lib/utils';

type OverviewStats = {
  users: number | null;
  groups: number | null;
  servicesConnected: number | null;
  servicesTotal: number | null;
  projects: number | null;
  environments: number | null;
  activeEnvironment: string | null;
};

type SetupStep = {
  id: string;
  label: string;
  detail: string;
  done: boolean;
  href: string;
};

function isConsoleSection(value: string | null): value is ConsoleSectionId | 'overview' {
  return CONSOLE_SECTIONS.some((section) => section.id === value);
}

function ServiceRow({
  item,
  meta,
}: {
  item: ConsoleNavItem;
  meta?: string | null;
}) {
  const Icon = item.icon;
  return (
    <Link
      to={item.path}
      data-testid={item.testId}
      className={cn(
        'group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-outline-variant/70 px-3 py-3 transition-colors last:border-b-0',
        'hover:bg-surface-container-low',
      )}
    >
      <span className="flex size-9 items-center justify-center rounded-lg bg-primary-container text-on-primary-container">
        <Icon size={16} aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-on-surface group-hover:text-primary">
          {item.name}
        </span>
        <span className="mt-0.5 block truncate text-xs text-on-surface-variant">{item.description}</span>
      </span>
      <span className="flex items-center gap-2">
        {meta ? (
          <span className="hidden rounded-md bg-surface-container px-2 py-0.5 text-[11px] font-medium text-on-surface-variant sm:inline">
            {meta}
          </span>
        ) : null}
        <ArrowRight
          size={14}
          className="text-on-surface-variant opacity-0 transition-opacity group-hover:opacity-100"
          aria-hidden="true"
        />
      </span>
    </Link>
  );
}

export default function ConsoleHome() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') ?? '';
  const sectionParam = searchParams.get('section');
  const activeSection = isConsoleSection(sectionParam) ? sectionParam : 'overview';

  const [stats, setStats] = useState<OverviewStats>({
    users: null,
    groups: null,
    servicesConnected: null,
    servicesTotal: null,
    projects: null,
    environments: null,
    activeEnvironment: null,
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [usersRes, groupsRes, servicesRes, boardsRes, envsRes] = await Promise.allSettled([
        api.listIdentityUsers(),
        api.listIdentityGroups(),
        api.listConsoleServices(),
        api.listBoards(),
        api.listEnvironments(),
      ]);
      if (cancelled) return;

      const users = usersRes.status === 'fulfilled' ? usersRes.value.users.length : null;
      const groups = groupsRes.status === 'fulfilled' ? groupsRes.value.groups.length : null;
      const services =
        servicesRes.status === 'fulfilled'
          ? {
              connected: servicesRes.value.services.filter((s) => s.connected).length,
              total: servicesRes.value.services.length,
            }
          : null;
      const projects = boardsRes.status === 'fulfilled' ? boardsRes.value.length : null;
      const environments =
        envsRes.status === 'fulfilled'
          ? {
              count: envsRes.value.environments.length,
              active:
                envsRes.value.environments.find((e) => e.id === envsRes.value.activeEnvironmentId) ??
                null,
            }
          : null;

      setStats({
        users,
        groups,
        servicesConnected: services?.connected ?? null,
        servicesTotal: services?.total ?? null,
        projects,
        environments: environments?.count ?? null,
        activeEnvironment: environments?.active
          ? environmentDisplayName(environments.active.name, environments.active.key)
          : null,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CONSOLE_NAV_ITEMS;
    return CONSOLE_NAV_ITEMS.filter(
      (tile) =>
        tile.name.toLowerCase().includes(q) ||
        tile.description.toLowerCase().includes(q) ||
        tile.keywords.some((k) => k.includes(q)),
    );
  }, [query]);

  const sectionItems = useMemo(() => {
    if (activeSection === 'overview') return filtered;
    return filtered.filter((item) => item.section === activeSection);
  }, [activeSection, filtered]);

  const setupSteps: SetupStep[] = useMemo(
    () => [
      {
        id: 'connections',
        label: 'Connect a platform',
        detail: 'Link Jira, Slack, cloud, or observability tools',
        done: (stats.servicesConnected ?? 0) > 0,
        href: '/connections',
      },
      {
        id: 'users',
        label: 'Invite your team',
        detail: 'Add people and assign roles or groups',
        done: (stats.users ?? 0) > 1,
        href: '/console/users',
      },
      {
        id: 'projects',
        label: 'Open a delivery project',
        detail: 'Boards and work queues for your teams',
        done: (stats.projects ?? 0) > 0,
        href: '/projects',
      },
      {
        id: 'security',
        label: 'Review security',
        detail: '2FA, passkeys, and platform access keys',
        done: false,
        href: '/admin',
      },
    ],
    [stats.projects, stats.servicesConnected, stats.users],
  );

  const setupDone = setupSteps.filter((s) => s.done).length;

  const setSection = (id: ConsoleSectionId | 'overview') => {
    const next = new URLSearchParams(searchParams);
    if (id === 'overview') next.delete('section');
    else next.set('section', id);
    setSearchParams(next, { replace: true });
  };

  const metaFor = (item: ConsoleNavItem): string | null => {
    switch (item.id) {
      case 'users':
        return stats.users == null ? null : `${stats.users} member${stats.users === 1 ? '' : 's'}`;
      case 'groups':
        return stats.groups == null ? null : `${stats.groups} group${stats.groups === 1 ? '' : 's'}`;
      case 'services':
        return stats.servicesConnected == null
          ? null
          : `${stats.servicesConnected} connected`;
      case 'projects':
        return stats.projects == null ? null : `${stats.projects} project${stats.projects === 1 ? '' : 's'}`;
      case 'environments':
        return stats.activeEnvironment ?? (stats.environments == null ? null : `${stats.environments} levels`);
      default:
        return item.hint;
    }
  };

  const statCards = [
    {
      label: 'People',
      value: stats.users,
      hint: stats.groups == null ? 'Members' : `${stats.groups} groups`,
      href: '/console/users',
    },
    {
      label: 'Services',
      value: stats.servicesConnected,
      hint:
        stats.servicesTotal == null
          ? 'Connected'
          : `of ${stats.servicesTotal} in catalog`,
      href: '/console/services',
    },
    {
      label: 'Projects',
      value: stats.projects,
      hint: 'Delivery boards',
      href: '/projects',
    },
    {
      label: 'Environment',
      value: stats.activeEnvironment,
      hint: stats.environments == null ? 'Active level' : `${stats.environments} configured`,
      href: '/console/environments',
      textual: true,
    },
  ] as const;

  return (
    <PageContainer width="operational" className="flex flex-col gap-6" data-testid="console-home">
      <PageHeader
        eyebrow="Workspace"
        title="Console"
        description="Manage people, platforms, and delivery for this workspace."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/console/users">
              <Button type="button" variant="secondary" data-testid="console-invite-cta">
                <UserPlus size={16} aria-hidden="true" />
                Invite people
              </Button>
            </Link>
            <Link to="/connections">
              <Button type="button" data-testid="console-connect-cta">
                <Link2 size={16} aria-hidden="true" />
                Connect platforms
              </Button>
            </Link>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="console-home-stats">
        {statCards.map((card) => (
          <Link
            key={card.label}
            to={card.href}
            className="rounded-xl border border-outline-variant bg-surface px-4 py-3 transition-colors hover:border-primary/35 hover:bg-surface-container-low"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-on-surface-variant">
              {card.label}
            </p>
            <p className="mt-1 truncate text-xl font-semibold tracking-tight text-on-surface">
              {'textual' in card && card.textual
                ? (card.value ?? '—')
                : card.value == null
                  ? '—'
                  : card.value}
            </p>
            <p className="mt-0.5 text-xs text-on-surface-variant">{card.hint}</p>
          </Link>
        ))}
      </div>

      <div
        role="tablist"
        aria-label="Console sections"
        className="flex gap-1 overflow-x-auto border-b border-outline-variant pb-px"
        data-testid="console-home-tabs"
      >
        {CONSOLE_SECTIONS.map((section) => {
          const selected = activeSection === section.id;
          return (
            <button
              key={section.id}
              type="button"
              role="tab"
              aria-selected={selected}
              data-testid={`console-tab-${section.id}`}
              onClick={() => setSection(section.id)}
              className={cn(
                'relative shrink-0 rounded-t-md px-3.5 py-2.5 text-sm font-medium transition-colors',
                selected
                  ? 'text-on-surface'
                  : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface',
              )}
            >
              {section.label}
              {selected ? (
                <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />
              ) : null}
            </button>
          );
        })}
      </div>

      {query.trim() ? (
        <p className="text-sm text-on-surface-variant">
          Showing results for “{query}” · {sectionItems.length} match
          {sectionItems.length === 1 ? '' : 'es'}
        </p>
      ) : null}

      {activeSection === 'overview' && !query.trim() ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]" data-testid="console-home-overview">
          <section className="rounded-xl border border-outline-variant bg-surface">
            <div className="flex items-start justify-between gap-3 border-b border-outline-variant px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-on-surface">Get set up</h2>
                <p className="mt-0.5 text-xs text-on-surface-variant">
                  {setupDone} of {setupSteps.length} complete
                </p>
              </div>
              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-container-high self-center">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${(setupDone / setupSteps.length) * 100}%` }}
                />
              </div>
            </div>
            <ul className="divide-y divide-outline-variant/70">
              {setupSteps.map((step) => (
                <li key={step.id}>
                  <Link
                    to={step.href}
                    className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-surface-container-low"
                    data-testid={`console-setup-${step.id}`}
                  >
                    {step.done ? (
                      <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-success" aria-hidden="true" />
                    ) : (
                      <Circle size={18} className="mt-0.5 shrink-0 text-on-surface-variant" aria-hidden="true" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          'block text-sm font-medium',
                          step.done ? 'text-on-surface-variant line-through' : 'text-on-surface',
                        )}
                      >
                        {step.label}
                      </span>
                      <span className="mt-0.5 block text-xs text-on-surface-variant">{step.detail}</span>
                    </span>
                    <ArrowRight size={14} className="mt-1 shrink-0 text-on-surface-variant" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-xl border border-outline-variant bg-surface" data-testid="console-home-tiles">
            <div className="border-b border-outline-variant px-4 py-3">
              <h2 className="text-sm font-semibold text-on-surface">All console areas</h2>
              <p className="mt-0.5 text-xs text-on-surface-variant">
                Jump into identity, delivery, and integrations
              </p>
            </div>
            <div>
              {filtered.map((item) => (
                <ServiceRow key={item.path} item={item} meta={metaFor(item)} />
              ))}
            </div>
          </section>
        </div>
      ) : (
        <section className="rounded-xl border border-outline-variant bg-surface" data-testid="console-home-tiles">
          <div className="border-b border-outline-variant px-4 py-3">
            <h2 className="text-sm font-semibold text-on-surface">
              {CONSOLE_SECTIONS.find((s) => s.id === activeSection)?.label ?? 'Console'}
            </h2>
            <p className="mt-0.5 text-xs text-on-surface-variant">
              {sectionItems.length} area{sectionItems.length === 1 ? '' : 's'} in this section
            </p>
          </div>
          <div>
            {sectionItems.map((item) => (
              <ServiceRow key={item.path} item={item} meta={metaFor(item)} />
            ))}
          </div>
        </section>
      )}

      {sectionItems.length === 0 && (
        <p className="text-center text-sm text-on-surface-variant" data-testid="console-home-empty">
          No matches for “{query}”. Try users, roles, or projects from the search bar.
        </p>
      )}
    </PageContainer>
  );
}
