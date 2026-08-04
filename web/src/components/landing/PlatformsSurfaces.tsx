import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { MessageSquare, Monitor, Sparkles } from 'lucide-react';
import { getService, MARKETING_SURFACE_IDS } from '../../lib/serviceCatalog';
import { SwipePhoneDemo } from './SwipePhoneDemo';

const AGENT_LOGOS = MARKETING_SURFACE_IDS.agents.map((id) => getService(id)).filter(Boolean);
const CHAT_LOGOS = (['slack', 'teams', 'whatsapp', 'telegram'] as const)
  .map((id) => getService(id))
  .filter(Boolean);

/** Sample skill packs sourced from curated answer categories. */
export const SKILL_PACKS = [
  { id: 'bug-triage', name: 'Bug triage', category: 'Bugs & incidents' },
  { id: 'pii-docs', name: 'PII-safe docs', category: 'Docs & runbooks' },
  { id: 'test-plan', name: 'Test plan', category: 'QA answers' },
  { id: 'review-check', name: 'Review checklist', category: 'Review loop' },
] as const;

const AGENT_SKILLS = [
  {
    id: 'codex',
    serviceId: 'codex' as const,
    packs: ['Bug triage', 'Test plan'],
  },
  {
    id: 'claude_code',
    serviceId: 'claude_code' as const,
    packs: ['PII-safe docs', 'Review checklist'],
  },
  {
    id: 'cursor',
    serviceId: 'cursor' as const,
    packs: ['Bug triage', 'PII-safe docs'],
  },
  {
    id: 'chatgpt',
    serviceId: 'chatgpt' as const,
    packs: ['Test plan', 'Review checklist'],
  },
] as const;

export type PlatformsSurfacesProps = {
  /** Homepage teaser layout vs full platforms page depth. */
  teaser?: boolean;
  /** When false, skip the section eyebrow/heading (page already has one). */
  showIntro?: boolean;
};

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

/**
 * PLAT-6: Skills-aware platforms — agent surfaces show sample skill packs
 * from curated answer categories.
 */
export function PlatformsSurfaces({ teaser = false, showIntro = true }: PlatformsSurfacesProps) {
  return (
    <section
      className={`border-t border-outline-variant/60 ${teaser ? 'py-14 sm:py-16' : showIntro ? 'py-4' : 'border-t-0 py-2'}`}
      aria-labelledby={showIntro ? 'surfaces-heading' : undefined}
    >
      {showIntro ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-xl">
            <p className="text-sm font-semibold tracking-tight text-primary">
              {teaser ? 'Surfaces' : 'Platforms'}
            </p>
            <h2
              id="surfaces-heading"
              className="mt-2 font-serif text-3xl tracking-tight text-on-surface sm:text-4xl"
            >
              {teaser ? 'One path. Skills where you work.' : 'Surfaces with skills from answer groups.'}
            </h2>
            <p className="mt-3 text-base leading-7 text-on-surface-variant">
              Web and mobile are live. Chat and agents are Coming — when connected, agent clients
              receive skill packs built from curated answer categories.
            </p>
          </div>
          {teaser ? (
            <Link to="/platforms" className="shrink-0 text-sm font-semibold text-primary hover:underline">
              See all platforms →
            </Link>
          ) : null}
        </div>
      ) : null}

      <div className={`${showIntro ? 'mt-10' : ''} grid gap-6 lg:grid-cols-2`}>
        <motion.article
          className="grid gap-5 rounded-2xl border border-outline-variant/70 bg-surface-container-lowest p-5 sm:grid-cols-[auto_1fr] sm:items-center"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45 }}
        >
          <SwipePhoneDemo />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
                Speed
              </p>
              <StatusChip available />
            </div>
            <h3 className="mt-1 text-xl font-semibold tracking-tight">Mobile swipe triage</h3>
            <p className="mt-2 text-sm leading-6 text-on-surface-variant">
              Try it — right sends to AI, left assigns a person. Same triage as web; drafts still get
              reviewed before ship.
            </p>
          </div>
        </motion.article>

        <motion.article
          className="flex flex-col justify-center rounded-2xl border border-outline-variant/70 bg-surface-container-lowest p-5"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45, delay: 0.05 }}
        >
          <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary-container text-on-primary-container">
            <Monitor size={20} strokeWidth={1.7} aria-hidden="true" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
              Depth
            </p>
            <StatusChip available />
          </div>
          <h3 className="mt-1 text-xl font-semibold">Web control plane</h3>
          <p className="mt-2 text-sm leading-6 text-on-surface-variant">
            Policies, PII, queues, model preference, reviewed drafts, and audit — full configuration
            surface.
          </p>
        </motion.article>

        <motion.article
          className="rounded-2xl border border-outline-variant/70 bg-surface-container-lowest p-5"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45, delay: 0.08 }}
        >
          <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-butter-container text-on-butter-container">
            <MessageSquare size={20} strokeWidth={1.7} aria-hidden="true" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
              Conversation
            </p>
            <StatusChip available={false} />
          </div>
          <h3 className="mt-1 text-xl font-semibold">Chat channels</h3>
          <p className="mt-2 text-sm leading-6 text-on-surface-variant">
            Slack, Teams, WhatsApp, Telegram into the same governed queue.
          </p>
          <div className="mt-3 flex gap-2">
            {CHAT_LOGOS.map((s) =>
              s ? <img key={s.id} src={s.logo} alt="" className="h-7 w-7 rounded-md" /> : null,
            )}
          </div>
        </motion.article>

        <motion.article
          className="rounded-2xl border border-outline-variant/70 bg-surface-container-lowest p-5"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45, delay: 0.1 }}
        >
          <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-surface-container text-on-surface">
            <Sparkles size={20} strokeWidth={1.7} aria-hidden="true" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
              Agents · skills
            </p>
            <StatusChip available={false} />
          </div>
          <h3 className="mt-1 text-xl font-semibold">MCP / agent clients</h3>
          <p className="mt-2 text-sm leading-6 text-on-surface-variant">
            Cursor, ChatGPT, Codex, Claude Code — drafts after PII clear, human review, then skill
            packs from curated answer categories.
          </p>
          <div className="mt-3 flex gap-2">
            {AGENT_LOGOS.map((s) =>
              s ? <img key={s.id} src={s.logo} alt="" className="h-7 w-7 rounded-md" /> : null,
            )}
          </div>
        </motion.article>
      </div>

      {/* Skills-aware agent strip */}
      <motion.div
        className="mt-8 rounded-2xl border border-outline-variant/70 bg-surface-container-low/50 p-5 sm:p-6"
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.45 }}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
              Skill packs · from answer categories
            </p>
            <h3 className="mt-1 text-lg font-semibold tracking-tight text-on-surface sm:text-xl">
              After human review, agents get curated skills — platform keeps control
            </h3>
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
            Coming
          </p>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {AGENT_SKILLS.map((agent, i) => {
            const svc = getService(agent.serviceId);
            if (!svc) return null;
            return (
              <motion.div
                key={agent.id}
                className="rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-3.5"
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.05 + i * 0.05, duration: 0.35 }}
              >
                <div className="flex items-center gap-2">
                  <img src={svc.logo} alt="" className="h-7 w-7 rounded-md" />
                  <p className="text-sm font-semibold text-on-surface">{svc.name}</p>
                </div>
                <ul className="mt-3 space-y-1.5">
                  {agent.packs.map((pack) => (
                    <li
                      key={pack}
                      className="rounded-lg bg-butter-container/70 px-2.5 py-1.5 text-[11px] font-semibold text-on-butter-container"
                    >
                      {pack}
                    </li>
                  ))}
                </ul>
              </motion.div>
            );
          })}
        </div>

        {!teaser ? (
          <div className="mt-5 flex flex-wrap gap-2 border-t border-outline-variant/50 pt-4">
            <p className="mr-2 self-center text-xs font-semibold text-on-surface-variant">
              Categories:
            </p>
            {SKILL_PACKS.map((pack) => (
              <span
                key={pack.id}
                className="rounded-chip border border-outline-variant/60 bg-surface px-2.5 py-1 text-[11px] font-semibold text-on-surface"
              >
                {pack.name}
                <span className="ml-1.5 font-normal text-on-surface-variant">· {pack.category}</span>
              </span>
            ))}
          </div>
        ) : null}
      </motion.div>
    </section>
  );
}
