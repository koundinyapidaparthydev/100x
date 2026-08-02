import { motion } from 'motion/react';
import { getService, marketingAvailability, MARKETING_SURFACE_IDS } from '../../lib/serviceCatalog';

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

const FLOW_LOGOS = [
  ...MARKETING_SURFACE_IDS.boards.slice(0, 3),
  ...MARKETING_SURFACE_IDS.conversation.slice(0, 2),
].map((id) => getService(id)).filter(Boolean);

/**
 * Full-bleed flow strip: connect logos → live-looking work rows → swipe affordance.
 * Edge-to-edge within the hero plane — not an inset floppy mock.
 */
export function HeroVisual() {
  return (
    <div className="relative w-full" aria-hidden="true">
      <div
        className="pointer-events-none absolute inset-x-0 -top-8 bottom-0 -z-10 opacity-90"
        style={{
          background:
            'linear-gradient(180deg, color-mix(in srgb, var(--color-primary-container) 55%, transparent) 0%, transparent 70%), radial-gradient(ellipse 70% 50% at 70% 30%, color-mix(in srgb, var(--color-mint-container) 50%, transparent), transparent 65%)',
        }}
      />

      <motion.div
        className="overflow-hidden border-y border-outline-variant/70 bg-surface/90 backdrop-blur-[2px]"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Connect strip */}
        <div className="flex items-center gap-3 overflow-x-auto border-b border-outline-variant/60 px-4 py-3 sm:px-6">
          <p className="shrink-0 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
            Connect
          </p>
          <div className="flex items-center gap-2">
            {FLOW_LOGOS.map((svc, i) =>
              svc ? (
                <motion.div
                  key={svc.id}
                  className="flex shrink-0 items-center gap-2 rounded-lg border border-outline-variant/60 bg-surface-container-lowest px-2.5 py-1.5"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25 + i * 0.08, duration: 0.4 }}
                >
                  <img src={svc.logo} alt="" className="h-5 w-5 rounded" />
                  <span className="text-xs font-semibold text-on-surface">{svc.name}</span>
                  <span
                    className={`text-[10px] font-semibold ${
                      marketingAvailability(svc) === 'Available'
                        ? 'text-mint'
                        : 'text-on-surface-variant'
                    }`}
                  >
                    {marketingAvailability(svc)}
                  </span>
                </motion.div>
              ) : null,
            )}
          </div>
          <motion.span
            className="ml-auto hidden shrink-0 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-on-surface-variant sm:inline"
            animate={{ opacity: [0.45, 1, 0.45] }}
            transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
          >
            → queue
          </motion.span>
        </div>

        <div className="grid lg:grid-cols-[1.35fr_0.85fr]">
          {/* Queue rows */}
          <div className="min-w-0 border-b border-outline-variant/60 p-4 sm:p-5 lg:border-b-0 lg:border-r">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-on-surface-variant">Work queue · ACME</p>
                <p className="text-sm font-semibold tracking-tight text-on-surface">
                  12 triage · 4 review · 1 blocked
                </p>
              </div>
              <motion.span
                className="inline-flex items-center gap-1.5 rounded-chip bg-mint-container px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-on-mint-container"
                animate={{ opacity: [0.55, 1, 0.55] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-mint" />
                Synced
              </motion.span>
            </div>
            <div className="space-y-2">
              {QUEUE.map((row, index) => (
                <motion.div
                  key={row.key}
                  className="flex items-center justify-between gap-3 border border-outline-variant/50 bg-surface-container-lowest px-3 py-2.5"
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    delay: 0.45 + index * 0.14,
                    duration: 0.45,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  <div className="min-w-0">
                    <p className="font-mono text-[10px] font-semibold text-on-surface-variant">
                      {row.key}
                    </p>
                    <p className="truncate text-sm font-semibold text-on-surface">{row.title}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-chip px-2 py-0.5 text-[10px] font-semibold ${TONE[row.tone]}`}
                  >
                    {row.status}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Swipe affordance */}
          <div className="flex flex-col justify-center gap-4 p-4 sm:p-5">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
              Decide on swipe
            </p>
            <motion.div
              className="relative mx-auto w-full max-w-[14rem] border border-outline-variant/70 bg-surface-container-lowest p-4"
              animate={{ x: [0, 10, 0, -10, 0] }}
              transition={{ duration: 4.8, repeat: Infinity, ease: 'easeInOut', delay: 1.2 }}
            >
              <p className="font-mono text-[10px] text-on-surface-variant">PROJ-184</p>
              <p className="mt-1 text-sm font-semibold text-on-surface">Pagination bug on boards</p>
              <div className="mt-4 flex justify-between gap-2 text-[10px] font-semibold uppercase tracking-[0.08em]">
                <span className="text-on-surface-variant">← Human</span>
                <span className="text-mint">AI →</span>
              </div>
            </motion.div>
            <div className="flex justify-center gap-6 text-xs font-semibold text-on-surface-variant">
              <span>Left · assign person</span>
              <span>Right · send to AI</span>
            </div>
          </div>
        </div>

        {/* Flow labels */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-outline-variant/60 px-4 py-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-on-surface-variant sm:px-6">
          {['Connect', 'Queue', 'Swipe', 'Clean', 'Cloud', 'Review'].map((label, i) => (
            <span key={label} className="inline-flex items-center gap-2">
              <span className="text-on-surface">{label}</span>
              {i < 5 && <span className="text-outline-variant">→</span>}
            </span>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
