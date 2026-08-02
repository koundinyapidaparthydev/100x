import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MARKETING_SURFACE_IDS,
  marketingAvailability,
  marketingServices,
  type ServiceCatalogEntry,
} from '../../lib/serviceCatalog';

type SurfaceTab = {
  id: keyof typeof MARKETING_SURFACE_IDS;
  label: string;
  blurb: string;
};

const TABS: SurfaceTab[] = [
  {
    id: 'boards',
    label: 'Boards',
    blurb: 'Work platforms sync tickets into the queue. Jira is ready to connect today.',
  },
  {
    id: 'conversation',
    label: 'Chat & messaging',
    blurb: 'Slack, Teams, Discord, WhatsApp, and Telegram — all Coming until channel OAuth ships.',
  },
  {
    id: 'agents',
    label: 'MCP & agents',
    blurb: 'Cursor, ChatGPT, Codex, and Claude Code pull cleared ticket context after connect — Coming.',
  },
  {
    id: 'cloud',
    label: 'Cloud',
    blurb: 'AWS, GCP, Azure, and NVIDIA — Available with secure customer setup.',
  },
];

function ServiceChip({ service }: { service: ServiceCatalogEntry }) {
  const label = marketingAvailability(service);
  return (
    <div className="flex items-center gap-3 border border-outline-variant/60 bg-surface-container-lowest px-3 py-2.5">
      <img src={service.logo} alt="" className="h-8 w-8 shrink-0 rounded-lg" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-on-surface">{service.name}</p>
        {service.secureHint && (
          <p className="mt-0.5 truncate text-xs text-on-surface-variant">{service.secureHint}</p>
        )}
      </div>
      <span
        className={`shrink-0 text-[11px] font-semibold uppercase tracking-[0.06em] ${
          label === 'Available' ? 'text-mint' : 'text-on-surface-variant'
        }`}
      >
        {label}
      </span>
    </div>
  );
}

export type ConnectionSurfacesProps = {
  /** Teaser shows fewer rows per tab. */
  teaser?: boolean;
};

/**
 * Interactive category tabs for boards / chat / agents / cloud with Available vs Coming.
 */
export function ConnectionSurfaces({ teaser = false }: ConnectionSurfacesProps) {
  const [active, setActive] = useState<SurfaceTab['id']>('boards');
  const tab = TABS.find((t) => t.id === active)!;
  const services = marketingServices(MARKETING_SURFACE_IDS[active]);
  const shown = teaser ? services.slice(0, 4) : services;

  return (
    <section
      className={teaser ? 'py-12 sm:py-14' : 'py-16 sm:py-20'}
      aria-labelledby="connection-surfaces-heading"
    >
      <div className={teaser ? 'max-w-2xl' : 'mx-auto max-w-2xl text-center'}>
        <p className="text-sm font-semibold tracking-tight text-primary">Connections</p>
        <h2
          id="connection-surfaces-heading"
          className={`mt-2 font-semibold tracking-tight ${
            teaser ? 'text-2xl sm:text-3xl' : 'text-3xl sm:text-4xl'
          }`}
        >
          {teaser ? 'What you can connect' : 'Surfaces you connect once'}
        </h2>
        <p className="mt-3 text-base leading-7 text-on-surface-variant">
          Honest Available / Coming labels from the catalog — planned surfaces stay Coming.
        </p>
      </div>

      <div className="mt-8">
        <div
          role="tablist"
          aria-label="Connection categories"
          className="flex gap-1 overflow-x-auto border-b border-outline-variant/70 pb-px"
        >
          {TABS.map((t) => {
            const selected = t.id === active;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActive(t.id)}
                className={`shrink-0 border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors ${
                  selected
                    ? 'border-on-surface text-on-surface'
                    : 'border-transparent text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            role="tabpanel"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3 }}
            className="mt-5"
          >
            <p className="mb-4 text-sm leading-6 text-on-surface-variant">{tab.blurb}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {shown.map((service) => (
                <ServiceChip key={service.id} service={service} />
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
