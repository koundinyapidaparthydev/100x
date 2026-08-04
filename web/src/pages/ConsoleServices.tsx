import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '@shared/api';
import type { ServiceCategory, ServiceId } from '@shared/types';
import { useAsync } from '../lib/useAsync';
import {
  AsyncBoundary,
  Card,
  Chip,
  Field,
  PageContainer,
  PageHeader,
  StatusBadge,
} from '../components/ui';
import { humanize } from '../lib/format';
import {
  getService,
  SERVICE_CATALOG,
  SERVICE_CATEGORY_LABELS,
} from '../lib/serviceCatalog';
import { cn } from '../lib/utils';

type StatusFilter = 'all' | 'connected' | 'available';

type EnrichedService = {
  id: string;
  name: string;
  category: ServiceCategory;
  logo?: string;
  connected: boolean;
  permissionLevel: string | null;
  availability: string;
  notes?: string;
  source: string;
  inMcpApi: boolean;
};

const AVAILABILITY_LABELS: Record<string, string> = {
  official_remote: 'Official remote MCP',
  official_local: 'Official local MCP',
  community: 'Community MCP',
  none: 'Not available',
};

const PATH_STEPS = [
  {
    id: 'catalog',
    label: 'Catalog',
    detail: 'Browse platforms by category',
  },
  {
    id: 'connections',
    label: 'Connections',
    detail: 'Connect with a permission level',
  },
  {
    id: 'permission',
    label: 'Permission / MCP',
    detail: 'Govern tools and access',
  },
] as const;

function availabilityLabel(availability: string) {
  return AVAILABILITY_LABELS[availability] ?? humanize(availability || 'unknown');
}

function ConnectPathStrip() {
  return (
    <nav
      aria-label="Connect path"
      className="rounded-xl border border-outline-variant/70 bg-surface-container/40 px-3 py-3 sm:px-4"
    >
      <ol className="flex flex-col gap-3 sm:flex-row sm:items-stretch sm:gap-0">
        {PATH_STEPS.map((step, index) => (
          <li
            key={step.id}
            className={cn(
              'relative flex min-w-0 flex-1 items-start gap-3',
              index < PATH_STEPS.length - 1 &&
                'sm:after:absolute sm:after:right-0 sm:after:top-4 sm:after:h-px sm:after:w-6 sm:after:translate-x-1/2 sm:after:bg-outline-variant',
            )}
          >
            <span
              className={cn(
                'flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
                index === 0
                  ? 'border-primary bg-primary text-on-primary'
                  : 'border-outline-variant bg-surface text-on-surface-variant',
              )}
              aria-hidden="true"
            >
              {index + 1}
            </span>
            <div className="min-w-0 flex-1 pr-2 sm:pr-8">
              <p className="text-sm font-semibold text-on-surface">{step.label}</p>
              <p className="mt-0.5 text-xs leading-5 text-on-surface-variant">{step.detail}</p>
              {index === PATH_STEPS.length - 1 ? (
                <Link
                  to="/connections"
                  className="mt-1.5 inline-block text-xs font-medium text-primary hover:underline"
                >
                  Open Connections
                </Link>
              ) : null}
              {index < PATH_STEPS.length - 1 ? (
                <span
                  className="mt-2 block h-4 w-px bg-outline-variant sm:hidden"
                  aria-hidden="true"
                />
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function ServiceRow({ service }: { service: EnrichedService }) {
  const [notesOpen, setNotesOpen] = useState(false);
  const mcpLabel = availabilityLabel(String(service.availability));
  const hasNotes = Boolean(service.notes?.trim());

  return (
    <article
      className={cn(
        'flex min-h-11 flex-col gap-2 rounded-xl border border-outline-variant bg-surface px-3 py-2.5',
        service.connected && 'border-primary/30 bg-primary-container/20',
      )}
      data-testid={`console-service-${service.id}`}
    >
      <div className="flex items-start gap-3">
        {service.logo ? (
          <img
            src={service.logo}
            alt=""
            className="size-8 shrink-0 rounded-lg border border-outline-variant bg-surface object-contain p-1"
          />
        ) : (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-container text-[10px] font-semibold text-on-surface-variant">
            {service.name.slice(0, 2).toUpperCase()}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-on-surface">{service.name}</h3>
            <StatusBadge
              status={service.connected ? 'success' : 'neutral'}
              label={service.connected ? 'Connected' : 'Not connected'}
            />
          </div>
          <p className="mt-0.5 truncate font-mono text-[11px] text-on-surface-variant">
            {service.id}
            <span className="mx-1.5 text-outline-variant">·</span>
            <span className="font-sans">{mcpLabel}</span>
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {service.permissionLevel ? (
            <Chip
              tone="mint"
              selected={false}
              tabIndex={-1}
              className="pointer-events-none min-h-7 px-2 py-0.5 text-xs"
            >
              {humanize(service.permissionLevel)}
            </Chip>
          ) : (
            <span className="text-xs text-on-surface-variant">—</span>
          )}
          <Link
            to={`/connections?focus=${encodeURIComponent(service.id)}`}
            className="min-h-8 text-xs font-medium text-primary hover:underline"
          >
            {service.connected ? 'Manage' : 'Connect'}
          </Link>
        </div>
      </div>

      {hasNotes ? (
        <div className="pl-11">
          <button
            type="button"
            className="flex w-full items-start gap-1.5 text-left text-xs leading-5 text-on-surface-variant"
            aria-expanded={notesOpen}
            onClick={() => setNotesOpen((open) => !open)}
          >
            <ChevronDown
              className={cn(
                'mt-0.5 size-3.5 shrink-0 transition-transform',
                notesOpen && 'rotate-180',
              )}
              aria-hidden="true"
            />
            <span className={cn(!notesOpen && 'line-clamp-1')}>{service.notes}</span>
          </button>
        </div>
      ) : null}
    </article>
  );
}

export default function ConsoleServices() {
  const { data, loading, error, reload } = useAsync(() => api.listConsoleServices(), []);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<ServiceCategory | 'all'>('all');

  const enriched = useMemo(() => {
    const apiById = new Map((data?.services ?? []).map((s) => [s.id, s]));
    const catalogIds = new Set(SERVICE_CATALOG.map((s) => s.id));

    const fromCatalog = SERVICE_CATALOG.filter((s) => !s.displayOnly).map((entry) => {
      const remote = apiById.get(entry.id);
      return {
        id: entry.id,
        name: entry.name,
        category: entry.category,
        logo: entry.logo,
        connected: remote?.connected ?? false,
        permissionLevel: remote?.permissionLevel ?? null,
        availability: remote?.availability ?? entry.status,
        notes: remote?.notes ?? entry.secureHint ?? entry.mcpServerHint,
        source: remote?.source ?? 'catalog',
        inMcpApi: Boolean(remote),
      } satisfies EnrichedService;
    });

    const apiOnly = (data?.services ?? [])
      .filter((s) => !catalogIds.has(s.id as ServiceId))
      .map((s) => {
        const catalog = getService(s.id as ServiceId);
        return {
          id: s.id,
          name: catalog?.name ?? s.name,
          category: (catalog?.category ?? 'boards') as ServiceCategory,
          logo: catalog?.logo,
          connected: s.connected,
          permissionLevel: s.permissionLevel,
          availability: s.availability ?? s.category,
          notes: s.notes ?? catalog?.secureHint,
          source: s.source,
          inMcpApi: true,
        } satisfies EnrichedService;
      });

    return [...fromCatalog, ...apiOnly];
  }, [data]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return enriched.filter((s) => {
      if (statusFilter === 'connected' && !s.connected) return false;
      if (statusFilter === 'available' && s.connected) return false;
      if (categoryFilter !== 'all' && s.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q) ||
        SERVICE_CATEGORY_LABELS[s.category]?.toLowerCase().includes(q) ||
        (s.notes ?? '').toLowerCase().includes(q)
      );
    });
  }, [enriched, query, statusFilter, categoryFilter]);

  const categoryCounts = useMemo(() => {
    const counts = Object.fromEntries(
      (Object.keys(SERVICE_CATEGORY_LABELS) as ServiceCategory[]).map((key) => [key, 0]),
    ) as Record<ServiceCategory, number>;
    for (const service of enriched) {
      if (statusFilter === 'connected' && !service.connected) continue;
      if (statusFilter === 'available' && service.connected) continue;
      const q = query.trim().toLowerCase();
      if (q) {
        const matches =
          service.name.toLowerCase().includes(q) ||
          service.id.toLowerCase().includes(q) ||
          SERVICE_CATEGORY_LABELS[service.category]?.toLowerCase().includes(q) ||
          (service.notes ?? '').toLowerCase().includes(q);
        if (!matches) continue;
      }
      counts[service.category] += 1;
    }
    return counts;
  }, [enriched, query, statusFilter]);

  const grouped = useMemo(() => {
    const order = Object.keys(SERVICE_CATEGORY_LABELS) as ServiceCategory[];
    return order
      .map((category) => ({
        category,
        label: SERVICE_CATEGORY_LABELS[category],
        items: filtered.filter((s) => s.category === category),
      }))
      .filter((g) => g.items.length > 0);
  }, [filtered]);

  const connectedCount = enriched.filter((s) => s.connected).length;
  const statusCounts = {
    all: enriched.length,
    connected: connectedCount,
    available: enriched.length - connectedCount,
  };

  const categoryTabs: Array<{ id: ServiceCategory | 'all'; label: string; count: number }> = [
    { id: 'all', label: 'All', count: Object.values(categoryCounts).reduce((a, b) => a + b, 0) },
    ...(Object.keys(SERVICE_CATEGORY_LABELS) as ServiceCategory[]).map((key) => ({
      id: key,
      label: SERVICE_CATEGORY_LABELS[key],
      count: categoryCounts[key],
    })),
  ];

  return (
    <PageContainer width="operational" data-testid="console-services-page">
      <PageHeader
        eyebrow="Catalog"
        title="Services"
        description="Platforms in the product catalog and MCP connect surface. Connect them from Connections with a permission level."
        actions={
          <Link to="/connections" className="text-sm font-medium text-primary hover:underline">
            Open Connections
          </Link>
        }
      />
      <AsyncBoundary loading={loading} error={error} onRetry={reload}>
        <div className="space-y-5">
          <ConnectPathStrip />

          <Card
            title="Service catalog"
            description={`${filtered.length} shown · ${connectedCount} connected · ${enriched.length} total`}
          >
            <div className="space-y-3">
              <Field
                label="Search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Jira, Slack, AWS…"
                data-testid="console-services-search"
              />

              <div
                className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                role="group"
                aria-label="Status filter"
                data-testid="console-services-status"
              >
                {(
                  [
                    { id: 'all', label: 'All' },
                    { id: 'connected', label: 'Connected' },
                    { id: 'available', label: 'Not connected' },
                  ] as const
                ).map((option) => (
                  <Chip
                    key={option.id}
                    tone="primary"
                    selected={statusFilter === option.id}
                    count={statusCounts[option.id]}
                    onClick={() => setStatusFilter(option.id)}
                    className="shrink-0"
                  >
                    {option.label}
                  </Chip>
                ))}
              </div>

              <div
                role="tablist"
                aria-label="Service categories"
                className="flex gap-1 overflow-x-auto border-b border-outline-variant/70 pb-px [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                data-testid="console-services-category"
              >
                {categoryTabs.map((tab) => {
                  const selected = categoryFilter === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      onClick={() => setCategoryFilter(tab.id)}
                      className={cn(
                        'shrink-0 border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors',
                        selected
                          ? 'border-on-surface text-on-surface'
                          : 'border-transparent text-on-surface-variant hover:text-on-surface',
                      )}
                    >
                      {tab.label}
                      <span className="ml-1.5 text-xs font-medium text-on-surface-variant">
                        {tab.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {grouped.length === 0 ? (
              <p className="py-10 text-center text-sm text-on-surface-variant">
                No services match. Clear filters or try another search.
              </p>
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${categoryFilter}-${statusFilter}-${query}`}
                  role="tabpanel"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2 }}
                  className="mt-4 space-y-6"
                >
                  {grouped.map((group) => (
                    <section key={group.category} aria-labelledby={`svc-${group.category}`}>
                      {categoryFilter === 'all' ? (
                        <h2
                          id={`svc-${group.category}`}
                          className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-on-surface-variant"
                        >
                          {group.label}
                        </h2>
                      ) : (
                        <h2 id={`svc-${group.category}`} className="sr-only">
                          {group.label}
                        </h2>
                      )}
                      <ul className="grid gap-2 sm:grid-cols-2">
                        {group.items.map((service) => (
                          <li key={service.id}>
                            <ServiceRow service={service} />
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </motion.div>
              </AnimatePresence>
            )}
          </Card>
        </div>
      </AsyncBoundary>
    </PageContainer>
  );
}
