import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { Button } from '../components/ui';
import { MarketingShell, MarketingWidth, PlatformsSurfaces } from '../components/landing';

const VOLUME_BARS = [
  { label: 'Surfaces', value: 28, hint: 'Web · mobile · chat · agents' },
  { label: 'Same queue', value: 62, hint: 'One triage lane' },
  { label: 'Governed runs', value: 88, hint: 'PII · policy · audit' },
  { label: 'Human review', value: 100, hint: 'Merge stays yours' },
];

export default function Platforms() {
  return (
    <MarketingShell testId="platforms-page">
      <MarketingWidth as="main">
        <header className="mx-auto max-w-2xl py-10 text-center sm:py-14">
          <p className="text-sm font-semibold tracking-tight text-primary">Platforms</p>
          <h1 className="mt-2 font-serif text-4xl tracking-tight text-on-surface sm:text-5xl">
            One governed path. Skills where you work.
          </h1>
          <p className="mt-4 text-base leading-7 text-on-surface-variant sm:text-lg sm:leading-8">
            Web for depth, mobile for swipe triage, chat and agent clients when you connect them —
            agents receive skill packs from curated answer categories. Honest Available vs Coming.
          </p>
        </header>

        <PlatformsSurfaces showIntro={false} />

        <section
          className="mt-14 border-t border-outline-variant/60 pt-12 sm:mt-16 sm:pt-14"
          aria-labelledby="platforms-impact-heading"
        >
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold tracking-tight text-primary">Scale</p>
            <h2
              id="platforms-impact-heading"
              className="mt-2 font-serif text-2xl tracking-tight sm:text-3xl"
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
        </section>

        <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 border-t border-outline-variant/60 pb-10 pt-14 text-center">
          <p className="text-base text-on-surface-variant">
            Open a live free workspace — connect, triage, and review a draft.
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
