import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '../components/ui';
import { MarketingShell, MarketingWidth, SwipePhoneDemo } from '../components/landing';
import { getService, type ServiceCatalogEntry } from '../lib/serviceCatalog';
import type { ServiceId } from '@shared/types';

const CHAT_IDS: ServiceId[] = ['slack', 'teams', 'whatsapp', 'telegram'];
const AGENT_IDS: ServiceId[] = ['cursor', 'chatgpt', 'codex', 'claude_code'];

const QUEUE_ROWS = [
  { key: 'PROJ-184', title: 'Pagination bug on boards', status: 'Needs triage', tone: 'butter' as const },
  { key: 'PROJ-191', title: 'Add audit export CSV', status: 'Send to AI', tone: 'mint' as const },
  { key: 'PROJ-203', title: 'PII rule for phone fields', status: 'Ready for review', tone: 'primary' as const },
];

const TONE = {
  butter: 'bg-butter-container text-on-butter-container',
  mint: 'bg-mint-container text-on-mint-container',
  primary: 'bg-primary-container text-on-primary-container',
};

const VOLUME_BARS = [
  { label: 'Surfaces', value: 28, hint: 'Web · mobile · chat · agents' },
  { label: 'Same queue', value: 62, hint: 'One triage lane' },
  { label: 'Governed runs', value: 88, hint: 'PII · policy · audit' },
  { label: 'Human review', value: 100, hint: 'Merge stays yours' },
];

function StatusChip({ available }: { available: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-chip px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${
        available
          ? 'bg-mint-container text-on-mint-container'
          : 'bg-surface-container text-on-surface-variant'
      }`}
    >
      {available ? 'Available' : 'Coming'}
    </span>
  );
}

function LogoTile({ service }: { service: ServiceCatalogEntry }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-outline-variant/60 bg-surface-container-lowest px-3 py-4">
      <img src={service.logo} alt="" className="h-9 w-9 rounded-lg" />
      <span className="text-center text-xs font-semibold text-on-surface">{service.name}</span>
    </div>
  );
}

function WebBrowserMock() {
  return (
    <motion.div
      className="overflow-hidden rounded-xl border border-outline-variant/80 bg-surface shadow-card"
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Browser chrome */}
      <div className="flex items-center gap-2 border-b border-outline-variant/60 bg-surface-container-low px-3 py-2.5">
        <div className="flex gap-1.5" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-outline-variant" />
          <span className="h-2.5 w-2.5 rounded-full bg-outline-variant" />
          <span className="h-2.5 w-2.5 rounded-full bg-outline-variant" />
        </div>
        <div className="ml-2 flex min-w-0 flex-1 items-center rounded-lg border border-outline-variant/50 bg-surface-container-lowest px-2.5 py-1">
          <span className="truncate font-mono text-[10px] text-on-surface-variant">
            aplify.ai/work · ACME
          </span>
        </div>
      </div>

      {/* Policy strip */}
      <div className="flex flex-wrap items-center gap-2 border-b border-outline-variant/50 bg-surface-container px-3 py-2">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-on-surface-variant">
          Policy
        </span>
        {['AI-first bugs', 'PII redact', 'VPC run'].map((rule) => (
          <span
            key={rule}
            className="rounded-chip bg-primary-container px-2 py-0.5 text-[10px] font-semibold text-on-primary-container"
          >
            {rule}
          </span>
        ))}
      </div>

      {/* Queue */}
      <div className="space-y-2 p-3">
        <div className="mb-1 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-on-surface">Work queue</p>
          <span className="text-[10px] font-semibold text-mint">12 triage</span>
        </div>
        {QUEUE_ROWS.map((row, i) => (
          <motion.div
            key={row.key}
            className="flex items-center justify-between gap-2 border border-outline-variant/50 bg-surface-container-lowest px-2.5 py-2"
            initial={{ opacity: 0, x: 10 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 + i * 0.1, duration: 0.4 }}
          >
            <div className="min-w-0">
              <p className="font-mono text-[9px] font-semibold text-on-surface-variant">{row.key}</p>
              <p className="truncate text-xs font-semibold text-on-surface">{row.title}</p>
            </div>
            <span className={`shrink-0 rounded-chip px-1.5 py-0.5 text-[9px] font-semibold ${TONE[row.tone]}`}>
              {row.status}
            </span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

function MobilePhoneMock() {
  return <SwipePhoneDemo maxWidthClass="max-w-[13rem]" animateIn />;
}

function LogoGridMock({ ids }: { ids: ServiceId[] }) {
  const services = ids.map((id) => getService(id)).filter(Boolean) as ServiceCatalogEntry[];
  return (
    <motion.div
      className="grid grid-cols-2 gap-2.5"
      initial={{ opacity: 0, scale: 0.96 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      {services.map((svc) => (
        <LogoTile key={svc.id} service={svc} />
      ))}
    </motion.div>
  );
}

function ImpactChart() {
  return (
    <section
      className="mt-14 border-t border-outline-variant/60 pt-12 sm:mt-16 sm:pt-14"
      aria-labelledby="platforms-impact-heading"
    >
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-semibold tracking-tight text-primary">Scale</p>
        <h2
          id="platforms-impact-heading"
          className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl"
        >
          Many surfaces. One governed path.
        </h2>
        <p className="mt-3 text-base leading-7 text-on-surface-variant">
          Volume compounds at the queue — then every run still hits PII, policy, and human review.
        </p>
      </div>

      <div className="mt-8 grid gap-5 sm:grid-cols-4">
        {VOLUME_BARS.map((bar, i) => (
          <motion.div
            key={bar.label}
            className="min-w-0"
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ delay: i * 0.08, duration: 0.45 }}
          >
            <p className="text-sm font-semibold text-on-surface">{bar.label}</p>
            <p className="mt-0.5 text-xs text-on-surface-variant">{bar.hint}</p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-container">
              <motion.div
                className="h-full rounded-full bg-primary"
                initial={{ width: 0 }}
                whileInView={{ width: `${bar.value}%` }}
                viewport={{ once: true }}
                transition={{ delay: 0.15 + i * 0.1, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Compact SVG flow underline */}
      <svg
        className="mt-8 h-10 w-full text-outline-variant"
        viewBox="0 0 800 40"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M20 20 H180 M200 20 H380 M400 20 H580 M600 20 H780"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="4 6"
          opacity="0.7"
        />
        {[20, 200, 400, 600, 780].map((x) => (
          <circle key={x} cx={x} cy={20} r="4" className="fill-primary" />
        ))}
        <text x="20" y="36" className="fill-on-surface-variant" fontSize="9" textAnchor="middle">
          In
        </text>
        <text x="400" y="36" className="fill-on-surface-variant" fontSize="9" textAnchor="middle">
          Queue
        </text>
        <text x="780" y="36" className="fill-on-surface-variant" fontSize="9" textAnchor="middle">
          Review
        </text>
      </svg>
    </section>
  );
}

const SURFACES = [
  {
    id: 'web',
    title: 'Web control plane',
    eyebrow: 'Depth',
    body: 'Connect boards, set policies, inspect AI drafts and artifacts, manage PII rules, runtime, and audit — the full configuration and review surface.',
    available: true,
    visual: <WebBrowserMock />,
  },
  {
    id: 'mobile',
    title: 'Mobile swipe triage',
    eyebrow: 'Speed',
    body: 'Managers decide AI-first vs human-first away from the desk. Swipe right for AI, left for a person; tap for status and approvals.',
    available: true,
    visual: <MobilePhoneMock />,
  },
  {
    id: 'chat',
    title: 'Chat channels',
    eyebrow: 'Conversation',
    body: 'Route work signals from Slack, Teams, WhatsApp, and Telegram into the same queue once channel connect ships.',
    available: false,
    visual: <LogoGridMock ids={CHAT_IDS} />,
  },
  {
    id: 'agents',
    title: 'MCP / agent clients',
    eyebrow: 'Agents',
    body: 'Cursor, ChatGPT, Codex, and Claude Code pull ticket stats and cleared context after connect — never ahead of PII clearing.',
    available: false,
    visual: <LogoGridMock ids={AGENT_IDS} />,
  },
] as const;

export default function Platforms() {
  return (
    <MarketingShell testId="platforms-page">
      <MarketingWidth as="main">
        <header className="mx-auto max-w-2xl py-10 text-center sm:py-14">
          <p className="text-sm font-semibold tracking-tight text-primary">Platforms</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
            One governed path. Many surfaces.
          </h1>
          <p className="mt-4 text-base leading-7 text-on-surface-variant sm:text-lg sm:leading-8">
            Web for depth, mobile for swipe triage, chat and agent clients when you connect them —
            same queue, same policy, honest Available vs Coming.
          </p>
        </header>

        <div className="grid gap-8 pb-4 sm:gap-10 lg:grid-cols-2">
          {SURFACES.map((platform, index) => (
            <motion.article
              key={platform.id}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.5, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
              className="grid gap-5"
            >
              <div className="min-h-[14rem]">{platform.visual}</div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
                    {platform.eyebrow}
                  </p>
                  <StatusChip available={platform.available} />
                </div>
                <h2 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">
                  {platform.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-on-surface-variant sm:text-base sm:leading-7">
                  {platform.body}
                </p>
              </div>
            </motion.article>
          ))}
        </div>

        <ImpactChart />

        <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 border-t border-outline-variant/60 pb-10 pt-14 text-center">
          <p className="text-base text-on-surface-variant">
            Open a live free workspace on the web control plane.
          </p>
          <Link to="/signup">
            <Button variant="primary">
              Start free <ArrowRight size={16} />
            </Button>
          </Link>
        </div>
      </MarketingWidth>
    </MarketingShell>
  );
}
