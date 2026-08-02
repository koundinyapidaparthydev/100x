import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

const SWIPE_DECK = [
  { key: 'PROJ-184', title: 'Pagination bug on boards' },
  { key: 'PROJ-191', title: 'Audit export CSV' },
  { key: 'PROJ-203', title: 'Phone field PII rule' },
  { key: 'PROJ-210', title: 'Flaky auth redirect' },
  { key: 'PROJ-218', title: 'Cost budget alert copy' },
] as const;

type SwipeStamp = 'ai' | 'human' | null;

type SwipePhoneDemoProps = {
  /** Outer max width (Home uses a bit wider). */
  maxWidthClass?: string;
  /** Optional entrance motion for Platforms grid. */
  animateIn?: boolean;
};

export function SwipePhoneDemo({
  maxWidthClass = 'max-w-[14rem]',
  animateIn = false,
}: SwipePhoneDemoProps) {
  const [index, setIndex] = useState(0);
  const [stamp, setStamp] = useState<SwipeStamp>(null);
  const [exitX, setExitX] = useState(0);
  const [busy, setBusy] = useState(false);

  const remaining = Math.max(SWIPE_DECK.length - index, 0);
  const top = SWIPE_DECK[index];
  const behind = SWIPE_DECK.slice(index + 1, index + 3);

  const commitSwipe = (dir: 'ai' | 'human') => {
    if (busy || !top) return;
    setBusy(true);
    setStamp(dir);
    setExitX(dir === 'ai' ? 160 : -160);
    window.setTimeout(() => {
      setStamp(null);
      setExitX(0);
      setIndex((i) => (i + 1 >= SWIPE_DECK.length ? 0 : i + 1));
      setBusy(false);
    }, 520);
  };

  const phone = (
    <div className={`mx-auto w-full ${maxWidthClass}`}>
      <div className="overflow-hidden rounded-[1.75rem] border-[3px] border-on-surface/80 bg-surface-container-lowest shadow-card">
        <div className="mx-auto mt-2 h-1.5 w-14 rounded-full bg-on-surface/20" aria-hidden="true" />
        <div className="px-3 pb-4 pt-3">
          <div className="flex items-end justify-between gap-2">
            <div>
              <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
                Mobile triage
              </p>
              <p className="text-xs font-semibold text-on-surface">{remaining} waiting</p>
            </div>
            <p className="font-mono text-[9px] text-on-surface-variant">
              {Math.min(index + 1, SWIPE_DECK.length)}/{SWIPE_DECK.length}
            </p>
          </div>

          <div className="relative mt-3 h-[9.25rem]">
            {behind
              .map((card, i) => (
                <div
                  key={card.key}
                  className="absolute inset-x-0 rounded-xl border border-outline-variant/60 bg-surface-container-low"
                  style={{
                    top: (i + 1) * 6,
                    bottom: -(i + 1) * 2,
                    transform: `scale(${1 - (i + 1) * 0.04})`,
                    zIndex: 1,
                  }}
                  aria-hidden="true"
                />
              ))
              .reverse()}

            <AnimatePresence mode="popLayout">
              {top ? (
                <motion.div
                  key={top.key}
                  className="absolute inset-x-0 top-0 z-[2] cursor-grab touch-none select-none rounded-xl border border-outline-variant/70 bg-surface p-3 shadow-sm active:cursor-grabbing"
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.9}
                  onDragEnd={(_, info) => {
                    if (info.offset.x > 70 || info.velocity.x > 400) commitSwipe('ai');
                    else if (info.offset.x < -70 || info.velocity.x < -400) commitSwipe('human');
                  }}
                  initial={{ opacity: 0, scale: 0.96, y: 8 }}
                  animate={{
                    opacity: 1,
                    scale: 1,
                    y: 0,
                    x: exitX,
                    rotate: exitX === 0 ? 0 : exitX > 0 ? 12 : -12,
                  }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                  style={{ height: '8.5rem' }}
                >
                  <p className="font-mono text-[9px] text-on-surface-variant">{top.key}</p>
                  <p className="mt-1 text-sm font-semibold leading-snug text-on-surface">{top.title}</p>
                  <div className="mt-4 flex justify-between text-[9px] font-semibold uppercase tracking-[0.08em]">
                    <span className="text-on-surface-variant">← Human</span>
                    <span className="text-mint">AI →</span>
                  </div>

                  <AnimatePresence>
                    {stamp === 'ai' ? (
                      <motion.div
                        key="ai-stamp"
                        className="pointer-events-none absolute right-2 top-3 rotate-12 rounded border-[2.5px] border-mint px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-mint"
                        initial={{ opacity: 0, scale: 1.4, rotate: 28 }}
                        animate={{ opacity: 1, scale: 1, rotate: 12 }}
                        exit={{ opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                      >
                        AI
                      </motion.div>
                    ) : null}
                    {stamp === 'human' ? (
                      <motion.div
                        key="human-stamp"
                        className="pointer-events-none absolute left-2 top-3 -rotate-12 rounded border-[2.5px] border-on-surface/55 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-on-surface/70"
                        initial={{ opacity: 0, scale: 1.4, rotate: -28 }}
                        animate={{ opacity: 1, scale: 1, rotate: -12 }}
                        exit={{ opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                      >
                        Human
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={busy}
              className="rounded-lg border border-outline-variant/70 py-2 text-[10px] font-semibold text-on-surface-variant disabled:opacity-50"
              onClick={() => commitSwipe('human')}
            >
              ← Human
            </button>
            <button
              type="button"
              disabled={busy}
              className="rounded-lg border border-mint/40 bg-mint-container/50 py-2 text-[10px] font-semibold text-on-mint-container disabled:opacity-50"
              onClick={() => commitSwipe('ai')}
            >
              AI →
            </button>
          </div>
          <p className="mt-2 text-center text-[9px] text-on-surface-variant">
            Drag or tap — 5 tickets
          </p>
        </div>
      </div>
    </div>
  );

  if (!animateIn) return phone;

  return (
    <motion.div
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.35 }}
      transition={{ duration: 0.6, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
    >
      {phone}
    </motion.div>
  );
}
