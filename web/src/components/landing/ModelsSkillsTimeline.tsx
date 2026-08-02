import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { getService, MARKETING_SURFACE_IDS } from '../../lib/serviceCatalog';

const STAGE_MS = 2800;

type Step = {
  id: string;
  label: string;
  title: string;
  body: string;
};

/** Part 1 — collect → clear → cloud → output → review path → MR → human → model creation may start. */
const DATA_FLOW_STEPS: Step[] = [
  {
    id: 'collect',
    label: 'Collect',
    title: 'Boards and channels land in one queue',
    body: 'Jira tickets, Slack threads, and other surfaces sync in. The board stays the system of record.',
  },
  {
    id: 'clear',
    label: 'Clear',
    title: 'PII cleared before any model call',
    body: 'Redact, block, or hash first. Cleared context is what leaves for compute — never raw secrets.',
  },
  {
    id: 'cloud',
    label: 'Cloud',
    title: 'Private or public cloud, by policy',
    body: 'Cleared payloads run where you choose: customer cloud, private VPC, or managed plane.',
  },
  {
    id: 'output',
    label: 'Output',
    title: 'A bounded draft comes back',
    body: 'The run returns a specific output — plan, patch, notes — still attached to the work item.',
  },
  {
    id: 'review',
    label: 'Reviewers',
    title: 'Reviewer path when it fits',
    body: 'When the output matches a reviewer lane (CodeRabbit or your own), it continues toward an MR.',
  },
  {
    id: 'mr',
    label: 'MR',
    title: 'Open an MR after draft review',
    body: 'Nothing merges on autopilot. The change lands as a merge request with an audit trail.',
  },
  {
    id: 'human',
    label: 'Human',
    title: 'A person verifies before ship',
    body: 'Approve or reject. Only after human verification does model-creation context unlock.',
  },
];

/** Part 2a — custom model from approved input + solution pairs. */
const MODEL_STEPS: Step[] = [
  {
    id: 'pair',
    label: 'Pairs',
    title: 'Approved input + approved solution',
    body: 'Ticket or Slack context on one side, the human-verified output on the other — both already cleared.',
  },
  {
    id: 'train',
    label: 'Train',
    title: 'Train a custom model on those pairs',
    body: 'Data and solution together become training signal. That trained artifact is your custom model.',
  },
  {
    id: 'match',
    label: 'Match',
    title: 'Same work again? Match at ≥90%',
    body: 'When a new task matches a trained pattern at about 90% or better, the custom model can answer without a fresh human gate.',
  },
  {
    id: 'serve',
    label: 'Serve',
    title: 'Request the model, get the response',
    body: 'Teams send governed requests to that custom model and receive responses shaped by what humans already approved.',
  },
];

/** Part 2b — skills as categorized patterns for agent kits. */
const SKILL_STEPS: Step[] = [
  {
    id: 'categorize',
    label: 'Categorize',
    title: 'Group the work that was done',
    body: 'Approved runs form categories — text change patterns, bug triage, docs, and other repeatable jobs.',
  },
  {
    id: 'pattern',
    label: 'Pattern',
    title: 'A pattern becomes a skill',
    body: 'When the same kind of change shows up again and again, that category becomes a skill pack you control.',
  },
  {
    id: 'integrate',
    label: 'Integrate',
    title: 'Wire skills into Cursor, Claude Code, and more',
    body: 'After human review, developers install those skills in the kits they already use — Cursor, Claude Code, Codex, ChatGPT.',
  },
  {
    id: 'ship',
    label: 'Ship',
    title: 'Skills run where the team works',
    body: 'The platform keeps ownership of the category; the agent client gets a governed skill after review — not a shadow prompt.',
  },
];

const AGENT_LOGOS = MARKETING_SURFACE_IDS.agents
  .map((id) => getService(id))
  .filter(Boolean);

function AutoLoopTimeline({
  steps,
  ariaLabel,
}: {
  steps: readonly Step[];
  ariaLabel: string;
}) {
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const step = steps[index]!;
  const last = steps.length - 1;
  const playhead = last === 0 ? 0 : index >= last ? 1 : (index + progress) / last;

  useEffect(() => {
    const started = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - started) / STAGE_MS);
      setProgress(t);
      if (t >= 1) {
        setIndex((i) => (i + 1) % steps.length);
        setProgress(0);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [index, steps.length]);

  return (
    <div className="mx-auto max-w-3xl" aria-label={ariaLabel}>
      <div className="relative py-6" aria-hidden="true">
        <div className="h-2 rounded-full bg-surface-container">
          <div className="h-full rounded-full bg-primary" style={{ width: `${playhead * 100}%` }} />
        </div>
        <div className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-between">
          {steps.map((s, i) => (
            <span
              key={s.id}
              className={`h-4 w-4 rounded-full border-2 transition-transform ${
                i <= index
                  ? 'scale-110 border-primary bg-primary'
                  : 'border-outline-variant bg-surface'
              }`}
            />
          ))}
        </div>
        <div
          className="pointer-events-none absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full border-2 border-on-surface bg-butter"
          style={{ left: `calc(${playhead * 100}% - 10px)` }}
        />
      </div>

      <div className="mt-2 flex justify-between gap-1 overflow-x-auto">
        {steps.map((s, i) => (
          <span
            key={s.id}
            className={`shrink-0 px-1 text-center font-mono text-[10px] font-semibold uppercase tracking-[0.08em] ${
              i === index ? 'text-primary' : 'text-on-surface-variant'
            }`}
          >
            {s.label}
          </span>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.28 }}
          className="mt-8 rounded-2xl border border-outline-variant/70 bg-surface-container-low/80 px-6 py-10 sm:px-10"
        >
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-mint">
            {step.label}
          </p>
          <h3 className="mt-3 font-serif text-3xl tracking-tight text-on-surface">{step.title}</h3>
          <p className="mt-3 max-w-xl text-base leading-7 text-on-surface-variant">{step.body}</p>
          <div className="mt-6 h-1 overflow-hidden rounded-full bg-surface-container">
            <div className="h-full rounded-full bg-mint" style={{ width: `${progress * 100}%` }} />
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function SectionHead({
  eyebrow,
  titleId,
  title,
  support,
}: {
  eyebrow: string;
  titleId: string;
  title: string;
  support: string;
}) {
  return (
    <motion.div
      className="mx-auto max-w-2xl text-center"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <p className="text-sm font-semibold tracking-tight text-primary">{eyebrow}</p>
      <h2
        id={titleId}
        className="mt-2 font-serif text-3xl tracking-tight text-on-surface sm:text-4xl lg:text-[2.75rem] lg:leading-[1.12]"
      >
        {title}
      </h2>
      <p className="mt-3 text-base leading-7 text-on-surface-variant sm:text-lg sm:leading-8">
        {support}
      </p>
    </motion.div>
  );
}

export type ModelsSkillsTimelineProps = {
  /** When false, page-level header owns the intro; both parts still render with their own titles. */
  showIntro?: boolean;
};

/**
 * Two stories: (1) data flow to reviewed draft then human-verified MR, then (2) custom models vs skills.
 */
export function ModelsSkillsTimeline({ showIntro = true }: ModelsSkillsTimelineProps) {
  return (
    <div id="models-skills" className="scroll-mt-8">
      {showIntro ? (
        <div className="border-t border-outline-variant/60 pt-14 sm:pt-20">
          <motion.div
            className="mx-auto max-w-2xl text-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="text-sm font-semibold tracking-tight text-primary">Learning path</p>
            <h2 className="mt-2 font-serif text-3xl tracking-tight text-on-surface sm:text-4xl lg:text-[2.75rem] lg:leading-[1.12]">
              Data flow first. Models and skills after.
            </h2>
            <p className="mt-3 text-base leading-7 text-on-surface-variant sm:text-lg sm:leading-8">
              Cleared work becomes a reviewed draft, then a human-verified MR. Only then do we train
              a custom model and categorize skills for the kits your team already uses.
            </p>
          </motion.div>
        </div>
      ) : null}

      {/* Part 1 — data flow */}
      <section
        className={`${showIntro ? 'pt-10 sm:pt-12' : 'border-t border-outline-variant/60 pt-10 sm:pt-14'} pb-14 sm:pb-20`}
        aria-labelledby="data-flow-heading"
      >
        <SectionHead
          eyebrow="01 · Data flow"
          titleId="data-flow-heading"
          title="From collected work to a reviewed draft"
          support="Jira or Slack in, PII cleared, run in your cloud, draft back, reviewer path when it fits, MR for a human. Model creation starts only after that verify."
        />
        <div className="mt-10">
          <AutoLoopTimeline steps={DATA_FLOW_STEPS} ariaLabel="Data flow stages" />
        </div>
      </section>

      {/* Part 2 — models and skills as separate contexts */}
      <section
        className="border-t border-outline-variant/60 py-14 sm:py-20"
        aria-labelledby="model-skills-split-heading"
      >
        <SectionHead
          eyebrow="02 · After draft review"
          titleId="model-skills-split-heading"
          title="Custom models serve requests. Skills plug into your kits."
          support="Same reviewed history, two products: a model you can call, and categorized skills developers install in Cursor, Claude Code, and the rest — only after human review."
        />

        <div className="mt-12 grid gap-14 lg:grid-cols-2 lg:gap-10">
          <div>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
              Custom model
            </p>
            <h3 className="mt-2 font-serif text-2xl tracking-tight text-on-surface sm:text-3xl">
              Train on data + solution
            </h3>
            <p className="mt-2 text-sm leading-6 text-on-surface-variant">
              Request the model, get a response shaped by previously reviewed drafts — reuse that
              gate when the new task matches about 90% of what humans already approved.
            </p>
            <div className="mt-8">
              <AutoLoopTimeline steps={MODEL_STEPS} ariaLabel="Custom model stages" />
            </div>
          </div>

          <div>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
              Skills
            </p>
            <h3 className="mt-2 font-serif text-2xl tracking-tight text-on-surface sm:text-3xl">
              Categorize patterns for kits
            </h3>
            <p className="mt-2 text-sm leading-6 text-on-surface-variant">
              Text-change and other repeatable jobs become skills after human review. Integrate them
              into Claude Code, Cursor, Codex, or ChatGPT — under your control.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {AGENT_LOGOS.map((s) =>
                s ? (
                  <img
                    key={s.id}
                    src={s.logo}
                    alt={s.name}
                    title={s.name}
                    className="h-8 w-8 rounded-md"
                  />
                ) : null,
              )}
            </div>
            <div className="mt-6">
              <AutoLoopTimeline steps={SKILL_STEPS} ariaLabel="Skills stages" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
