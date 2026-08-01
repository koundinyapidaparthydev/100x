import { motion, AnimatePresence } from 'motion/react';

const QUEUE = [
  { key: 'PROJ-184', title: 'Pagination bug on boards', status: 'Needs triage', tone: 'butter' as const },
  { key: 'PROJ-191', title: 'Add audit export CSV', status: 'Send to AI', tone: 'mint' as const },
  { key: 'PROJ-203', title: 'PII rule for phone fields', status: 'Ready for review', tone: 'primary' as const },
];

const TONE = {
  butter: 'bg-butter-container text-on-butter-container',
  mint: 'bg-mint-container text-on-mint-container',
  primary: 'bg-primary-container text-on-primary-container',
};

/**
 * Dominant hero product visual — Tsenta-style live product mock,
 * adapted to AplifyAI work queue (connect → triage → review), not a card farm.
 */
export function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-2xl" aria-hidden="true">
      <div
        className="pointer-events-none absolute -inset-4 -z-10 rounded-[2rem] opacity-90 sm:-inset-6"
        style={{
          background:
            'radial-gradient(ellipse 80% 70% at 50% 40%, color-mix(in srgb, var(--color-primary-container) 70%, transparent), transparent 72%)',
        }}
      />

      <motion.div
        className="overflow-hidden rounded-2xl border border-outline-variant/80 bg-surface shadow-elevated"
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="grid sm:grid-cols-[7.5rem_1fr]">
          {/* Mini sidebar — echoes authenticated shell */}
          <aside className="hidden border-r border-outline-variant/70 bg-surface-container-low p-3 sm:block">
            <p className="font-serif text-sm tracking-tight text-on-surface">AplifyAI</p>
            <ul className="mt-4 space-y-1.5 text-[11px] font-semibold text-on-surface-variant">
              {['Projects', 'Work', 'Approvals', 'Governance'].map((item, i) => (
                <li
                  key={item}
                  className={`rounded-lg px-2 py-1.5 ${i === 1 ? 'bg-primary-container text-on-primary-container' : ''}`}
                >
                  {item}
                </li>
              ))}
            </ul>
          </aside>

          <div className="min-w-0">
            <div className="flex items-center justify-between border-b border-outline-variant/70 px-4 py-2.5">
              <div>
                <p className="text-xs font-semibold text-on-surface-variant">Project · ACME</p>
                <p className="text-sm font-semibold tracking-tight text-on-surface">Work queue</p>
              </div>
              <motion.span
                className="inline-flex items-center gap-1.5 rounded-chip bg-mint-container px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-on-mint-container"
                animate={{ opacity: [0.55, 1, 0.55] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-mint" />
                Syncing
              </motion.span>
            </div>

            <div className="space-y-2 p-3 sm:p-4">
              <AnimatePresence>
                {QUEUE.map((row, index) => (
                  <motion.div
                    key={row.key}
                    className="flex items-center justify-between gap-3 rounded-xl border border-outline-variant/60 bg-surface-container-lowest px-3 py-2.5"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      delay: 0.4 + index * 0.18,
                      duration: 0.5,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-[10px] font-semibold text-on-surface-variant">
                        {row.key}
                      </p>
                      <p className="truncate text-sm font-semibold text-on-surface">{row.title}</p>
                    </div>
                    <motion.span
                      className={`shrink-0 rounded-chip px-2 py-0.5 text-[10px] font-semibold ${TONE[row.tone]}`}
                      animate={{
                        boxShadow: [
                          '0 0 0 0 transparent',
                          '0 0 0 3px color-mix(in srgb, var(--color-primary) 14%, transparent)',
                          '0 0 0 0 transparent',
                        ],
                      }}
                      transition={{
                        delay: 1.5 + index * 0.9,
                        duration: 1.1,
                        repeat: Infinity,
                        repeatDelay: 2.2,
                      }}
                    >
                      {row.status}
                    </motion.span>
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Flow connector strip */}
              <div className="mt-3 flex items-center justify-between gap-1 px-1 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-on-surface-variant">
                {['Jira', 'Triage', 'AI', 'Review'].map((label, i) => (
                  <div key={label} className="flex flex-1 items-center gap-1">
                    <motion.span
                      className="rounded-chip bg-surface-container px-2 py-1 text-on-surface"
                      animate={{ backgroundColor: ['', ''] }}
                      initial={{ opacity: 0.5 }}
                      whileInView={{ opacity: 1 }}
                      transition={{ delay: 0.9 + i * 0.15 }}
                    >
                      {label}
                    </motion.span>
                    {i < 3 && (
                      <motion.span
                        className="h-px flex-1 bg-outline-variant"
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ delay: 1 + i * 0.15, duration: 0.35 }}
                        style={{ originX: 0 }}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      <motion.p
        className="mt-4 text-center text-xs text-on-surface-variant sm:mt-5"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.1, duration: 0.45 }}
      >
        Board stays the system of record — AplifyAI decides the next move.
      </motion.p>
    </div>
  );
}
