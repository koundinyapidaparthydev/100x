import { useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Bot,
  Brain,
  ClipboardCheck,
  GitPullRequest,
  Link2,
  Shield,
  Sparkles,
  Split,
  Wand2,
} from 'lucide-react';

type TrackStep = {
  id: string;
  label: string;
  title: string;
  body: string;
  icon: ReactNode;
};

const TICKET_STEPS: TrackStep[] = [
  {
    id: 'connect',
    label: 'Connect',
    title: 'Connect boards and channels',
    body: 'Link Jira and other boards, chat surfaces, and agent clients. Tickets land in one queue — the board stays the system of record.',
    icon: <Link2 size={16} strokeWidth={1.75} aria-hidden="true" />,
  },
  {
    id: 'triage',
    label: 'Triage',
    title: 'Decide AI vs human',
    body: 'Swipe or click: send to AI, or assign a person. Nothing runs until someone chooses — drafts still get reviewed before ship.',
    icon: <Split size={16} strokeWidth={1.75} aria-hidden="true" />,
  },
  {
    id: 'pii',
    label: 'PII',
    title: 'Clear before the model',
    body: 'Redact, block, or hash. Raw ticket text never reaches a model when rules say so.',
    icon: <Shield size={16} strokeWidth={1.75} aria-hidden="true" />,
  },
  {
    id: 'draft',
    label: 'Draft',
    title: 'AI drafts behind the firewall',
    body: 'After clearing, AI produces a bounded draft and attaches it to the ticket — still awaiting review.',
    icon: <Bot size={16} strokeWidth={1.75} aria-hidden="true" />,
  },
  {
    id: 'review',
    label: 'Review',
    title: 'Inspect the draft',
    body: 'Evidence, plan, and audit trail sit with the ticket — review the draft before anything opens as an MR.',
    icon: <ClipboardCheck size={16} strokeWidth={1.75} aria-hidden="true" />,
  },
  {
    id: 'ticket-mr',
    label: 'MR',
    title: 'Open the ticket MR after review',
    body: 'After draft review, open the merge request on GitHub or GitLab — agents propose, you ship.',
    icon: <GitPullRequest size={16} strokeWidth={1.75} aria-hidden="true" />,
  },
];

const MODEL_STEPS: TrackStep[] = [
  {
    id: 'preference',
    label: 'Preference',
    title: 'Set a model preference',
    body: 'Choose org defaults or a custom training path — preference starts the model lifecycle; review still gates ship.',
    icon: <Brain size={16} strokeWidth={1.75} aria-hidden="true" />,
  },
  {
    id: 'governed-data',
    label: 'Data',
    title: 'Train only on governed data',
    body: 'Training payloads stay inside the clearing, review, and policy path. Shadow exports never feed the model.',
    icon: <Shield size={16} strokeWidth={1.75} aria-hidden="true" />,
  },
  {
    id: 'train',
    label: 'Train',
    title: 'Build the custom model',
    body: 'A custom model is trained from curated, cleared, reviewed answers — still gated before anyone can use it.',
    icon: <Wand2 size={16} strokeWidth={1.75} aria-hidden="true" />,
  },
  {
    id: 'model-mr',
    label: 'Model MR',
    title: 'Model change lands as an MR after review',
    body: 'The custom model (or model-related change) lands as a reviewable MR after the draft gate — same human review as ticket work.',
    icon: <GitPullRequest size={16} strokeWidth={1.75} aria-hidden="true" />,
  },
  {
    id: 'try',
    label: 'Try',
    title: 'Try the custom model',
    body: 'After draft review, the org can try the custom model on governed runs — still behind PII and policy.',
    icon: <Sparkles size={16} strokeWidth={1.75} aria-hidden="true" />,
  },
  {
    id: 'skills',
    label: 'Skills',
    title: 'Ship skills from answer groups',
    body: 'After human review, curated answer categories become skill packs for Codex, Claude Code, Cursor, and ChatGPT — the platform keeps control.',
    icon: <Wand2 size={16} strokeWidth={1.75} aria-hidden="true" />,
  },
];

const GATE = {
  id: 'human-gate',
  label: 'Draft review',
  title: 'Human reviews the draft',
  body: 'Ticket drafts and model MRs share one draft review: a person reviews the draft and evidence, approves or rejects, and the audit trail records the decision before ship or skills.',
};

export type DualTrackFlowProps = {
  variant?: 'full' | 'compact';
  autoAdvance?: boolean;
};

function StepChip({
  step,
  selected,
  onSelect,
  tone,
}: {
  step: TrackStep;
  selected: boolean;
  onSelect: () => void;
  tone: 'ticket' | 'model';
}) {
  const selectedTone =
    tone === 'ticket'
      ? 'bg-on-surface text-surface'
      : 'bg-primary text-on-primary';

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`inline-flex shrink-0 items-center gap-2 rounded-chip px-3 py-2 text-xs font-semibold transition-colors ${
        selected
          ? selectedTone
          : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface hover:text-on-surface'
      }`}
    >
      <span className="opacity-80">{step.icon}</span>
      <span>{step.label}</span>
    </button>
  );
}

function TrackColumn({
  eyebrow,
  title,
  steps,
  activeId,
  onSelect,
  tone,
  compact,
}: {
  eyebrow: string;
  title: string;
  steps: TrackStep[];
  activeId: string;
  onSelect: (id: string) => void;
  tone: 'ticket' | 'model';
  compact?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
        {eyebrow}
      </p>
      <h3 className="mt-1 text-lg font-semibold tracking-tight text-on-surface sm:text-xl">{title}</h3>
      <div className="mt-4 flex flex-wrap gap-2">
        {steps.map((step) => (
          <StepChip
            key={step.id}
            step={step}
            selected={activeId === step.id}
            onSelect={() => onSelect(step.id)}
            tone={tone}
          />
        ))}
      </div>
      {!compact ? (
        <ol className="mt-5 space-y-0">
          {steps.map((step, index) => {
            const active = activeId === step.id;
            return (
              <li key={step.id} className="relative flex gap-3 pb-4 last:pb-0">
                {index < steps.length - 1 ? (
                  <span
                    className="absolute left-[0.7rem] top-7 bottom-0 w-px bg-outline-variant/70"
                    aria-hidden="true"
                  />
                ) : null}
                <button
                  type="button"
                  onClick={() => onSelect(step.id)}
                  className={`relative z-[1] flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors ${
                    active
                      ? tone === 'ticket'
                        ? 'border-on-surface bg-on-surface text-surface'
                        : 'border-primary bg-primary text-on-primary'
                      : 'border-outline-variant bg-surface text-on-surface-variant'
                  }`}
                  aria-label={step.title}
                >
                  <span className="scale-90">{step.icon}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSelect(step.id)}
                  className={`min-w-0 flex-1 rounded-xl px-2 py-1 text-left transition-colors ${
                    active ? 'bg-surface-container-low' : 'hover:bg-surface-container-low/60'
                  }`}
                >
                  <p className="text-sm font-semibold text-on-surface">{step.title}</p>
                  <p className="mt-0.5 text-xs leading-5 text-on-surface-variant">{step.body}</p>
                </button>
              </li>
            );
          })}
        </ol>
      ) : null}
    </div>
  );
}

/**
 * HIW-1: Dual-track timeline — Ticket path + Model path with a shared human gate.
 */
export function DualTrackFlow({ variant = 'full', autoAdvance = false }: DualTrackFlowProps) {
  const allIds = [
    ...TICKET_STEPS.map((s) => s.id),
    GATE.id,
    ...MODEL_STEPS.map((s) => s.id),
  ];
  const [activeId, setActiveId] = useState(GATE.id);
  const compact = variant === 'compact';

  useEffect(() => {
    if (!autoAdvance) return;
    const id = window.setInterval(() => {
      setActiveId((current) => {
        const idx = allIds.indexOf(current);
        return allIds[(idx + 1) % allIds.length]!;
      });
    }, 4200);
    return () => window.clearInterval(id);
    // allIds is stable for the component lifetime
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAdvance]);

  const activeStep =
    activeId === GATE.id
      ? GATE
      : TICKET_STEPS.find((s) => s.id === activeId) ??
        MODEL_STEPS.find((s) => s.id === activeId) ??
        GATE;

  const activeTone =
    activeId === GATE.id
      ? 'gate'
      : TICKET_STEPS.some((s) => s.id === activeId)
        ? 'ticket'
        : 'model';

  return (
    <section
      id="how-it-works"
      className={`scroll-mt-8 ${compact ? 'py-12 sm:py-16' : 'py-16 sm:py-24'}`}
      aria-labelledby="how-it-works-heading"
    >
      <motion.div
        className="mx-auto max-w-2xl text-center"
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="text-sm font-semibold tracking-tight text-primary">How it works</p>
        <h2
          id="how-it-works-heading"
          className="mt-2 font-serif text-3xl tracking-tight text-on-surface sm:text-4xl"
        >
          {compact ? 'Two paths. One draft review.' : 'Ticket work and custom models — same draft review.'}
        </h2>
        <p className="mt-3 text-base leading-7 text-on-surface-variant">
          Day-to-day tickets clear PII and produce a reviewed draft. Custom models train on governed
          data, then open an MR only after a person approves — then skills flow to your agent tools.
        </p>
      </motion.div>

      <motion.div
        className="mt-10 sm:mt-12"
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.5 }}
      >
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-10">
          <TrackColumn
            eyebrow="Ticket path"
            title="Connect → triage → clear → draft → review → MR"
            steps={TICKET_STEPS}
            activeId={activeId}
            onSelect={setActiveId}
            tone="ticket"
            compact={compact}
          />
          <TrackColumn
            eyebrow="Model path"
            title="Preference → governed data → train → review → model MR → skills"
            steps={MODEL_STEPS}
            activeId={activeId}
            onSelect={setActiveId}
            tone="model"
            compact={compact}
          />
        </div>

        {/* Shared human gate */}
        <div className="relative mt-8 sm:mt-10">
          <div
            className="pointer-events-none absolute inset-x-8 -top-6 hidden h-6 border-x border-outline-variant/60 lg:block"
            aria-hidden="true"
          />
          <button
            type="button"
            onClick={() => setActiveId(GATE.id)}
            aria-pressed={activeId === GATE.id}
            className={`w-full rounded-2xl border px-5 py-5 text-left transition-colors sm:px-8 sm:py-6 ${
              activeId === GATE.id
                ? 'border-butter/50 bg-butter-container/70'
                : 'border-outline-variant/70 bg-surface-container-low/80 hover:border-butter/40 hover:bg-butter-container/40'
            }`}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-on-butter-container">
                  Shared · {GATE.label}
                </p>
                <p className="mt-1 font-serif text-2xl tracking-tight text-on-surface sm:text-3xl">
                  {GATE.title}
                </p>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-on-surface-variant sm:text-base sm:leading-7">
                  {GATE.body}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <span className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-on-primary">
                  Approve
                </span>
                <span className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm font-semibold text-on-surface">
                  Reject
                </span>
                <span className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm font-semibold text-on-surface-variant">
                  Audit
                </span>
              </div>
            </div>
          </button>
        </div>

        {/* Active detail panel */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeStep.id}
            className="mt-6 overflow-hidden rounded-2xl border border-outline-variant/80 bg-surface shadow-card"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="border-b border-outline-variant/60 bg-surface-container-low px-4 py-3 sm:px-5">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
                {activeTone === 'gate'
                  ? 'Shared draft review'
                  : activeTone === 'ticket'
                    ? 'Ticket path'
                    : 'Model path'}
              </p>
              <p className="mt-1 text-lg font-semibold tracking-tight text-on-surface sm:text-xl">
                {activeStep.title}
              </p>
            </div>
            <div className="p-4 sm:p-5">
              <p className="text-sm leading-6 text-on-surface-variant sm:text-base sm:leading-7">
                {activeStep.body}
              </p>
            </div>
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </section>
  );
}
