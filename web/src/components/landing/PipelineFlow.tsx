import { motion } from 'motion/react';
import { Shield, Split } from 'lucide-react';
import { getService, MARKETING_SURFACE_IDS } from '../../lib/serviceCatalog';
import { MarketingWidth } from './MarketingWidth';

const SOURCES = [
  ...MARKETING_SURFACE_IDS.boards.slice(0, 4),
  ...MARKETING_SURFACE_IDS.conversation.slice(0, 3),
]
  .map((id) => getService(id))
  .filter(Boolean);

const CLOUD = MARKETING_SURFACE_IDS.cloud
  .slice(0, 4)
  .map((id) => getService(id))
  .filter(Boolean);

const AGENTS = MARKETING_SURFACE_IDS.agents
  .slice(0, 4)
  .map((id) => getService(id))
  .filter(Boolean);

const REPOS = [
  getService('github'),
  getService('gitlab'),
  getService('github_enterprise'),
  getService('gitlab_self_managed'),
].filter(Boolean);

const REVIEWERS = ['Human review', 'CodeRabbit', 'Your reviewer'] as const;

function Wire({
  d,
  delay = 0,
  thick = false,
}: {
  d: string;
  delay?: number;
  thick?: boolean;
}) {
  return (
    <g>
      <path
        d={d}
        fill="none"
        stroke="var(--color-outline-variant)"
        strokeWidth={thick ? 2.5 : 1.75}
        strokeOpacity={0.7}
      />
      <motion.path
        d={d}
        fill="none"
        stroke="var(--color-primary)"
        strokeWidth={thick ? 2.5 : 1.75}
        strokeLinecap="round"
        strokeDasharray={thick ? '10 14' : '6 10'}
        animate={{ strokeDashoffset: [0, -48] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: 'linear', delay }}
      />
    </g>
  );
}

/** Vertical multi-wire fan into the next stage (mobile). */
function FanInDown() {
  return (
    <svg className="mx-auto my-1 h-11 w-48 text-primary" viewBox="0 0 192 44" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      {[24, 56, 96, 136, 168].map((x, i) => (
        <Wire key={x} delay={i * 0.06} d={`M ${x} 2 C ${x} 14, 96 22, 96 42`} />
      ))}
    </svg>
  );
}

function StepTrunk({ delay = 0 }: { delay?: number }) {
  return (
    <svg className="mx-auto h-9 w-8 text-primary" viewBox="0 0 32 36" aria-hidden="true">
      <Wire thick delay={delay} d="M 16 2 C 16 12, 16 24, 16 34" />
    </svg>
  );
}

function AgentsBlock() {
  return (
    <div className="rounded-xl border border-outline-variant/65 bg-surface-container-lowest p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-on-surface-variant">
        Agents draft
      </p>
      <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {AGENTS.map(
          (s) =>
            s && (
              <div key={s.id} className="flex items-center gap-2 rounded-lg border border-outline-variant/50 px-2 py-1.5">
                <img src={s.logo} alt="" className="h-5 w-5 rounded object-contain" />
                <span className="truncate text-[11px] font-semibold text-on-surface">{s.name}</span>
              </div>
            ),
        )}
      </div>
    </div>
  );
}

function ReviewBlock() {
  return (
    <div className="rounded-xl border border-butter/50 bg-butter-container/55 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-on-butter-container">
          Review loop · default 1×
        </p>
        <span className="rounded-md bg-surface/70 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-primary">
          1×
        </span>
      </div>
      <p className="mt-1 text-[11px] leading-4 text-on-surface-variant">
        Human + code review once by default — then open the MR.
      </p>
      <div className="mt-2 flex flex-wrap gap-1">
        {REVIEWERS.map((t) => (
          <span
            key={t}
            className="rounded border border-outline-variant/60 bg-surface px-1.5 py-0.5 text-[9px] font-semibold text-on-surface"
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

function MrBlock() {
  return (
    <div className="rounded-xl border border-primary/40 bg-primary-container/55 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-on-primary-container">
        Open MR / PR
      </p>
      <p className="mt-1 text-[11px] leading-4 text-on-surface-variant">
        Ships to the git host they already use.
      </p>
      <div className="mt-2 flex flex-wrap gap-1">
        {REPOS.map(
          (s) =>
            s && (
              <span
                key={s.id}
                className="inline-flex items-center gap-1 rounded border border-outline-variant/50 bg-surface px-1.5 py-0.5 text-[9px] font-semibold"
              >
                <img src={s.logo} alt="" className="h-3.5 w-3.5" />
                {s.name}
              </span>
            ),
        )}
      </div>
    </div>
  );
}

/**
 * Home 3 fan-in graph: Connect → Queue/PII/cloud → Agents → Review (1×) → GitHub/GitLab MR.
 * Mobile mirrors the same path top → bottom with multi-wire cascade.
 */
export function PipelineFlow() {
  return (
    <section
      className="relative w-full border-y border-outline-variant/60 bg-surface-container-low/35"
      aria-labelledby="pipeline-flow-heading"
    >
      <MarketingWidth className="py-9 sm:py-12">
        <div className="mb-6 flex flex-col gap-2 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-xl">
            <p className="text-sm font-semibold tracking-tight text-primary">The governed path</p>
            <h2
              id="pipeline-flow-heading"
              className="mt-1 text-2xl font-semibold tracking-tight text-on-surface sm:text-3xl"
            >
              From connected ticket to reviewed draft
            </h2>
            <p className="mt-2 text-sm leading-6 text-on-surface-variant sm:text-base sm:leading-7">
              Boards and chat fan into one queue. PII clears before models. Agents draft, review runs
              once by default (human + code review), then the MR opens on GitHub or GitLab.
            </p>
          </div>
          <p className="max-w-xs text-sm leading-6 text-on-surface-variant sm:text-right">
            Connect → triage → clear → draft → review → PR.
          </p>
        </div>

        {/* Desktop — Home 3 fan-in with draft → review → MR on the right */}
        <div className="relative hidden overflow-hidden rounded-2xl border border-outline-variant/70 bg-surface lg:block">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.22]"
            style={{
              backgroundImage:
                'radial-gradient(circle at 1px 1px, color-mix(in srgb, var(--color-outline-variant) 65%, transparent) 1px, transparent 0)',
              backgroundSize: '20px 20px',
            }}
            aria-hidden="true"
          />

          <div className="relative grid min-h-[30rem] grid-cols-[1.05fr_1.1fr_1.05fr] gap-0 px-5 py-8 xl:px-8">
            <svg
              className="pointer-events-none absolute inset-0 h-full w-full text-primary"
              viewBox="0 0 900 460"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              {[72, 130, 188, 246, 304, 362].map((y, i) => (
                <Wire key={`in-${y}`} delay={i * 0.12} d={`M 210 ${y} C 280 ${y}, 300 230, 360 230`} />
              ))}
              <Wire thick delay={0.2} d="M 500 230 C 540 230, 560 230, 600 230" />
              <Wire thick delay={0.35} d="M 600 230 C 650 230, 690 100, 740 90" />
              <Wire thick delay={0.42} d="M 600 230 C 650 230, 690 230, 740 230" />
              <Wire thick delay={0.5} d="M 600 230 C 650 230, 690 360, 740 370" />
            </svg>

            {/* Connect */}
            <div className="relative z-[1] flex flex-col justify-center gap-2.5 pr-4">
              <p className="mb-1 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
                Connect
              </p>
              {SOURCES.map((svc, i) =>
                svc ? (
                  <motion.div
                    key={svc.id}
                    className="flex items-center gap-3 rounded-xl border border-outline-variant/65 bg-surface-container-lowest px-3 py-2.5 shadow-sm"
                    initial={{ opacity: 0, x: -12 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.05 + i * 0.05, duration: 0.4 }}
                  >
                    <img src={svc.logo} alt="" className="h-8 w-8 rounded-md object-contain" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-on-surface">{svc.name}</p>
                      <p className="truncate text-[11px] text-on-surface-variant">
                        {svc.category === 'conversation' ? 'Chat signal' : 'Board / work'}
                      </p>
                    </div>
                  </motion.div>
                ) : null,
              )}
            </div>

            {/* Queue + PII */}
            <div className="relative z-[1] flex flex-col items-stretch justify-center gap-3 px-3">
              <motion.div
                className="rounded-2xl border border-primary/40 bg-primary-container/50 p-4"
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.15, duration: 0.45 }}
              >
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-on-primary-container">
                  Queue · triage
                </p>
                <p className="mt-1 text-base font-semibold text-on-surface">Synced work · ACME</p>
                <ul className="mt-3 space-y-1.5">
                  {[
                    { key: 'PROJ-184', title: 'Pagination bug on boards' },
                    { key: 'PROJ-191', title: 'Audit export CSV' },
                    { key: 'PROJ-203', title: 'Phone field PII rule' },
                  ].map((row) => (
                    <li
                      key={row.key}
                      className="flex items-center justify-between gap-2 rounded-lg border border-outline-variant/50 bg-surface/80 px-2.5 py-1.5"
                    >
                      <span className="min-w-0 truncate text-xs font-semibold text-on-surface">
                        <span className="font-mono text-[10px] text-on-surface-variant">{row.key}</span>{' '}
                        {row.title}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex items-center justify-between rounded-lg border border-dashed border-outline-variant/70 px-2.5 py-2 text-[11px] font-semibold uppercase tracking-[0.08em]">
                  <span className="inline-flex items-center gap-1 text-on-surface-variant">
                    <Split size={12} aria-hidden="true" /> Human
                  </span>
                  <span className="text-mint">AI →</span>
                </div>
              </motion.div>

              <motion.div
                className="rounded-2xl border border-mint/45 bg-mint-container/75 p-4 text-on-mint-container"
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.25, duration: 0.45 }}
              >
                <div className="flex items-center gap-2">
                  <Shield size={16} strokeWidth={2} aria-hidden="true" />
                  <p className="text-sm font-semibold">PII cleared before models</p>
                </div>
                <p className="mt-1 text-xs leading-5 opacity-90">
                  Redact, block, or hash — then choose runtime.
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <span className="rounded-md border border-on-mint-container/25 bg-surface/25 px-2 py-1 text-[10px] font-semibold">
                    private VPC
                  </span>
                  {CLOUD.map((svc) =>
                    svc ? (
                      <span
                        key={svc.id}
                        className="inline-flex items-center gap-1 rounded-md border border-on-mint-container/25 bg-surface/30 px-1.5 py-1"
                      >
                        <img src={svc.logo} alt="" className="h-3.5 w-3.5 rounded-sm" />
                        <span className="text-[10px] font-semibold">{svc.name}</span>
                      </span>
                    ) : null,
                  )}
                </div>
              </motion.div>
            </div>

            {/* Draft → review 1× → MR */}
            <div className="relative z-[1] flex flex-col justify-center gap-2.5 pl-4">
              <p className="mb-1 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
                Draft → review
              </p>
              <motion.div
                initial={{ opacity: 0, x: 12 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2, duration: 0.4 }}
              >
                <AgentsBlock />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: 12 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3, duration: 0.4 }}
              >
                <ReviewBlock />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: 12 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4, duration: 0.4 }}
              >
                <MrBlock />
              </motion.div>
            </div>
          </div>
        </div>

        {/* Mobile — same path, vertical cascade with multi-wires */}
        <div className="relative overflow-hidden rounded-2xl border border-outline-variant/70 bg-surface p-4 lg:hidden">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.18]"
            style={{
              backgroundImage:
                'radial-gradient(circle at 1px 1px, color-mix(in srgb, var(--color-outline-variant) 65%, transparent) 1px, transparent 0)',
              backgroundSize: '18px 18px',
            }}
            aria-hidden="true"
          />

          <div className="relative z-[1] flex flex-col">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
              Connect
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {SOURCES.map((svc, i) =>
                svc ? (
                  <motion.div
                    key={svc.id}
                    className="flex items-center gap-2 rounded-xl border border-outline-variant/65 bg-surface-container-lowest px-2.5 py-2"
                    initial={{ opacity: 0, y: -6 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.03, duration: 0.3 }}
                  >
                    <img src={svc.logo} alt="" className="h-6 w-6 rounded object-contain" />
                    <span className="truncate text-xs font-semibold">{svc.name}</span>
                  </motion.div>
                ) : null,
              )}
            </div>

            <FanInDown />

            <div className="rounded-2xl border border-primary/40 bg-primary-container/45 p-3.5">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-on-primary-container">
                Queue · triage
              </p>
              <p className="mt-1 text-sm font-semibold">Synced work · ACME</p>
              <ul className="mt-2.5 space-y-1.5">
                {[
                  { key: 'PROJ-184', title: 'Pagination bug on boards' },
                  { key: 'PROJ-191', title: 'Audit export CSV' },
                ].map((row) => (
                  <li
                    key={row.key}
                    className="rounded-lg border border-outline-variant/50 bg-surface/85 px-2.5 py-1.5 text-xs font-semibold"
                  >
                    <span className="font-mono text-[10px] text-on-surface-variant">{row.key}</span>{' '}
                    {row.title}
                  </li>
                ))}
              </ul>
              <div className="mt-2.5 flex items-center justify-between rounded-lg border border-dashed border-outline-variant/70 px-2.5 py-2 text-[10px] font-semibold uppercase tracking-[0.08em]">
                <span className="inline-flex items-center gap-1 text-on-surface-variant">
                  <Split size={11} aria-hidden="true" /> Human
                </span>
                <span className="text-mint">AI →</span>
              </div>
            </div>

            <StepTrunk delay={0.1} />

            <div className="rounded-2xl border border-mint/45 bg-mint-container/80 p-3.5 text-on-mint-container">
              <div className="flex items-center gap-2">
                <Shield size={15} strokeWidth={2} aria-hidden="true" />
                <p className="text-sm font-semibold">PII cleared before models</p>
              </div>
              <p className="mt-1 text-xs leading-5 opacity-90">Then run in the cloud you choose.</p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <span className="rounded-md border border-on-mint-container/25 bg-surface/25 px-2 py-1 text-[10px] font-semibold">
                  VPC
                </span>
                {CLOUD.map((svc) =>
                  svc ? (
                    <span
                      key={svc.id}
                      className="inline-flex items-center gap-1 rounded-md border border-on-mint-container/25 bg-surface/30 px-1.5 py-1 text-[10px] font-semibold"
                    >
                      <img src={svc.logo} alt="" className="h-3.5 w-3.5" />
                      {svc.name}
                    </span>
                  ) : null,
                )}
              </div>
            </div>

            <StepTrunk delay={0.2} />

            <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
              Draft → review
            </p>
            <div className="flex flex-col gap-2.5">
              <AgentsBlock />
              <StepTrunk delay={0.28} />
              <ReviewBlock />
              <StepTrunk delay={0.36} />
              <MrBlock />
            </div>
          </div>
        </div>
      </MarketingWidth>
    </section>
  );
}
