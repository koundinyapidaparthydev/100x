import { useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Bot, ClipboardCheck, Link2, Shield, Split } from 'lucide-react';

type StorySection = {
  id: string;
  step: string;
  label: string;
  title: string;
  body: string;
  icon: ReactNode;
  panel: ReactNode;
};

function PanelShell({
  eyebrow,
  headline,
  children,
}: {
  eyebrow: string;
  headline: string;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-outline-variant/80 bg-surface shadow-card">
      <div className="border-b border-outline-variant/60 bg-surface-container-low px-4 py-3 sm:px-5">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
          {eyebrow}
        </p>
        <p className="mt-1 text-lg font-semibold tracking-tight text-on-surface sm:text-xl">
          {headline}
        </p>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  );
}

const SECTIONS: StorySection[] = [
  {
    id: 'connect',
    step: '01',
    label: 'connect',
    title: 'Connect your Jira project',
    body: 'Sync a board into AplifyAI. Work items stay in Jira — the board remains the system of record.',
    icon: <Link2 size={18} strokeWidth={1.75} />,
    panel: (
      <PanelShell eyebrow="01 · connect → projects" headline="One project sync. Board stays source of truth.">
        <div className="space-y-3">
          <div className="rounded-xl border border-outline-variant/70 bg-surface-container-lowest px-4 py-3">
            <p className="text-xs font-semibold text-on-surface-variant">Connected project</p>
            <p className="mt-1 text-base font-semibold text-on-surface">ACME Delivery</p>
            <p className="mt-1 font-mono text-xs text-on-surface-variant">jira · ACME · last sync 2m ago</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { n: '12', l: 'Triage' },
              { n: '4', l: 'Review' },
              { n: '1', l: 'Blocked' },
            ].map((c) => (
              <div key={c.l} className="rounded-xl bg-surface-container px-2 py-3">
                <p className="text-xl font-semibold text-on-surface">{c.n}</p>
                <p className="text-[11px] font-semibold text-on-surface-variant">{c.l}</p>
              </div>
            ))}
          </div>
        </div>
      </PanelShell>
    ),
  },
  {
    id: 'govern',
    step: '02',
    label: 'govern',
    title: 'Set the rules once',
    body: 'Policies, PII firewall, model and cloud choices, and token budgets control what AI is allowed to do.',
    icon: <Shield size={18} strokeWidth={1.75} />,
    panel: (
      <PanelShell eyebrow="02 · govern → defaults" headline="Policy knobs before any model call.">
        <ul className="space-y-2">
          {[
            { k: 'PII firewall', v: 'On · phone, SSN blocked' },
            { k: 'Model', v: 'Org default · GPT-class' },
            { k: 'Token budget', v: 'Per ticket · capped' },
            { k: 'AI-first', v: 'Manager override allowed' },
          ].map((row) => (
            <li
              key={row.k}
              className="flex items-center justify-between gap-3 rounded-xl border border-outline-variant/60 bg-surface-container-lowest px-3 py-2.5"
            >
              <span className="text-sm font-semibold text-on-surface">{row.k}</span>
              <span className="text-xs text-on-surface-variant">{row.v}</span>
            </li>
          ))}
        </ul>
      </PanelShell>
    ),
  },
  {
    id: 'triage',
    step: '03',
    label: 'triage',
    title: 'Triage each item',
    body: 'Decide “Send to AI” or “Assign to a person” before work starts — on web or mobile.',
    icon: <Split size={18} strokeWidth={1.75} />,
    panel: (
      <PanelShell eyebrow="03 · triage → decision" headline="Send to AI, or assign to a person.">
        <div className="rounded-xl border border-outline-variant/70 bg-surface-container-lowest p-4">
          <p className="font-mono text-[11px] text-on-surface-variant">PROJ-184</p>
          <p className="mt-1 text-base font-semibold text-on-surface">Pagination bug on boards</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl bg-mint-container px-3 py-3 text-on-mint-container">
              <p className="text-sm font-semibold">Send to AI</p>
              <p className="mt-1 text-xs opacity-80">Bounded draft · PII gated</p>
            </div>
            <div className="rounded-xl border border-outline-variant/70 bg-surface px-3 py-3">
              <p className="text-sm font-semibold text-on-surface">Assign to person</p>
              <p className="mt-1 text-xs text-on-surface-variant">Human-first path</p>
            </div>
          </div>
        </div>
      </PanelShell>
    ),
  },
  {
    id: 'ai',
    step: '04',
    label: 'ai',
    title: 'AI runs behind the firewall',
    body: 'Sensitive fields are gated first. Then AI produces a bounded draft and attaches artifacts back to the ticket.',
    icon: <Bot size={18} strokeWidth={1.75} />,
    panel: (
      <PanelShell eyebrow="04 · ai → firewall" headline="Gate PII. Then draft. Then attach.">
        <ol className="space-y-2 font-mono text-xs text-on-surface-variant">
          {[
            { t: 'PII scan', s: 'passed', tone: 'mint' },
            { t: 'Model run', s: 'bounded 20%', tone: 'primary' },
            { t: 'Artifacts', s: 'on ticket', tone: 'butter' },
          ].map((row) => (
            <li
              key={row.t}
              className="flex items-center justify-between rounded-xl border border-outline-variant/60 bg-surface-container-lowest px-3 py-2.5"
            >
              <span className="font-sans text-sm font-semibold text-on-surface">{row.t}</span>
              <span
                className={`rounded-chip px-2 py-0.5 font-sans text-[10px] font-semibold ${
                  row.tone === 'mint'
                    ? 'bg-mint-container text-on-mint-container'
                    : row.tone === 'butter'
                      ? 'bg-butter-container text-on-butter-container'
                      : 'bg-primary-container text-on-primary-container'
                }`}
              >
                {row.s}
              </span>
            </li>
          ))}
        </ol>
      </PanelShell>
    ),
  },
  {
    id: 'review',
    step: '05',
    label: 'review',
    title: 'Review and approve',
    body: 'Inspect output, approve or reject, and keep an audit trail of every decision.',
    icon: <ClipboardCheck size={18} strokeWidth={1.75} />,
    panel: (
      <PanelShell eyebrow="05 · review → approvals" headline="Human judgment before anything moves.">
        <div className="space-y-3">
          <div className="rounded-xl border border-butter/25 bg-butter-container px-4 py-3 text-on-butter-container">
            <p className="text-sm font-semibold">Ready for review</p>
            <p className="mt-1 text-xs opacity-85">Draft analysis + plan attached to PROJ-191</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-on-primary">
              Approve
            </span>
            <span className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm font-semibold text-on-surface">
              Reject
            </span>
            <span className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm font-semibold text-on-surface-variant">
              Audit trail
            </span>
          </div>
        </div>
      </PanelShell>
    ),
  },
];

/**
 * Tsenta-inspired stage stepper: numbered tabs swap a rich product panel,
 * plus a vertical one-job-per-section scroll story with whileInView motion.
 */
export function HowItWorks() {
  const [active, setActive] = useState(0);
  const current = SECTIONS[active]!;

  return (
    <section id="how-it-works" className="scroll-mt-8 py-16 sm:py-24" aria-labelledby="how-it-works-heading">
      <motion.div
        className="mx-auto max-w-2xl text-center"
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="text-sm font-semibold tracking-tight text-primary">The pipeline</p>
        <h2 id="how-it-works-heading" className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          Five stages. One governed path.
        </h2>
        <p className="mt-3 text-base leading-7 text-on-surface-variant">
          Connect, set policy, triage, run AI, then review — before anything moves forward.
        </p>
      </motion.div>

      {/* Interactive stage tabs — Tsenta find/prep/apply/track pattern */}
      <motion.div
        className="mx-auto mt-10 max-w-4xl sm:mt-12"
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.5 }}
      >
        <div
          role="tablist"
          aria-label="Product stages"
          className="flex gap-1 overflow-x-auto rounded-chip border border-outline-variant/70 bg-surface-container-low p-1"
        >
          {SECTIONS.map((section, index) => {
            const selected = index === active;
            return (
              <button
                key={section.id}
                type="button"
                role="tab"
                aria-selected={selected}
                id={`stage-tab-${section.id}`}
                aria-controls={`stage-panel-${section.id}`}
                onClick={() => setActive(index)}
                className={`inline-flex shrink-0 items-center gap-2 rounded-chip px-3 py-2 text-xs font-semibold transition-colors sm:px-4 ${
                  selected
                    ? 'bg-on-surface text-surface'
                    : 'text-on-surface-variant hover:bg-surface hover:text-on-surface'
                }`}
              >
                <span className="font-mono">{section.step}</span>
                <span className="hidden sm:inline">{section.label}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
              Step {current.step}
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-on-surface sm:text-3xl">
              {current.title}
            </h3>
            <p className="mt-3 text-base leading-7 text-on-surface-variant">{current.body}</p>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={current.id}
              id={`stage-panel-${current.id}`}
              role="tabpanel"
              aria-labelledby={`stage-tab-${current.id}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              {current.panel}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Vertical scroll story — one job per section */}
      <ol className="relative mx-auto mt-16 max-w-3xl space-y-0 border-t border-outline-variant/60 pt-10 sm:mt-20">
        <div
          className="pointer-events-none absolute left-[1.35rem] top-14 bottom-4 w-px bg-outline-variant/80 sm:left-[1.6rem]"
          aria-hidden="true"
        />

        {SECTIONS.map((section, index) => (
          <motion.li
            key={section.id}
            id={section.id}
            className="relative scroll-mt-10 grid grid-cols-[auto_1fr] gap-4 py-6 sm:gap-6 sm:py-8"
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.35 }}
            transition={{
              duration: 0.55,
              delay: index * 0.04,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <div className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-container text-on-primary-container sm:h-12 sm:w-12">
              {section.icon}
            </div>
            <div className="min-w-0 pt-0.5">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
                Step {section.step}
              </p>
              <h3 className="mt-1 text-xl font-semibold tracking-tight text-on-surface sm:text-2xl">
                {section.title}
              </h3>
              <p className="mt-2 max-w-xl text-base leading-7 text-on-surface-variant">{section.body}</p>
            </div>
          </motion.li>
        ))}
      </ol>
    </section>
  );
}
