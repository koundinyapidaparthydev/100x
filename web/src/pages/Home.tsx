import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { postAuthPath } from '../lib/onboardingStorage';
import { readDemoSession } from '../lib/session';
import { Button } from '../components/ui';
import { AplifyLogo } from '../components/AplifyLogo';
import {
  ConnectionSurfaces,
  HowItWorks,
  MarketingShell,
  MarketingWidth,
  ModelsSkillsTimeline,
  PipelineFlow,
  PlatformsSurfaces,
} from '../components/landing';

/** Animated donut — hours saved vs remaining week. */
function ImpactDonut({
  savedPct,
  label,
  sub,
  delay = 0,
}: {
  savedPct: number;
  label: string;
  sub: string;
  delay?: number;
}) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const dash = (savedPct / 100) * c;
  return (
    <div className="flex flex-col items-center text-center">
      <svg className="h-36 w-36 text-primary" viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--color-surface-container)" strokeWidth="12" />
        <motion.circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          transform="rotate(-90 50 50)"
          initial={{ strokeDasharray: `0 ${c}` }}
          whileInView={{ strokeDasharray: `${dash} ${c}` }}
          viewport={{ once: true }}
          transition={{ duration: 1.1, delay, ease: [0.22, 1, 0.36, 1] }}
        />
        <text
          x="50"
          y="52"
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-on-surface"
          style={{ fontSize: 18, fontFamily: 'var(--font-serif)', fontWeight: 600 }}
        >
          {savedPct}%
        </text>
      </svg>
      <p className="mt-3 font-serif text-2xl tracking-tight text-on-surface sm:text-3xl">{label}</p>
      <p className="mt-1 max-w-[16rem] text-sm leading-6 text-on-surface-variant">{sub}</p>
    </div>
  );
}

export default function Home() {
  if (readDemoSession()) {
    return <Navigate to={postAuthPath()} replace />;
  }

  return (
    <MarketingShell testId="home-page">
      <div>
        <header className="relative w-full pb-4 pt-6 lg:pb-5 lg:pt-8">
          <MarketingWidth>
            <motion.div
              className="mx-auto max-w-3xl text-center"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="flex flex-col items-center gap-4">
                <AplifyLogo size={56} />
                <p className="font-serif text-4xl tracking-tight text-on-surface sm:text-5xl lg:text-6xl">
                  AplifyAI
                </p>
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-on-surface sm:text-4xl lg:text-[2.75rem] lg:leading-[1.12]">
                Decide what happens to each work item.
              </h1>
              <p className="mt-3 text-base leading-7 text-on-surface-variant sm:text-lg sm:leading-8">
                Connect boards and channels, clear PII, run in your cloud, review a draft with a
                human — then train custom models and ship skills into Cursor, Claude Code, and more.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <Link to="/signup">
                  <Button variant="primary">
                    Start free <ArrowRight size={16} />
                  </Button>
                </Link>
                <Link to="/how-it-works">
                  <Button variant="secondary">See how it works</Button>
                </Link>
              </div>
              <p className="mt-3 text-sm text-on-surface-variant">
                Live free workspace. No card required.
              </p>
            </motion.div>
          </MarketingWidth>
        </header>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
        >
          <PipelineFlow />
        </motion.div>

        <MarketingWidth as="main">
          <ModelsSkillsTimeline />

          {/* Impact — big type + charts */}
          <section className="border-t border-outline-variant/60 py-14 sm:py-20" aria-labelledby="impact-heading">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-sm font-semibold tracking-tight text-primary">Impact</p>
              <h2
                id="impact-heading"
                className="mt-3 font-serif text-4xl tracking-tight text-on-surface sm:text-5xl lg:text-6xl"
              >
                Hours back. PII held. Review yours.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-on-surface-variant sm:text-lg sm:leading-8">
                Directional planning numbers — not a promise. Tap into the blog explorer to model your
                board volume.
              </p>
            </div>

            <div className="mt-12 grid gap-10 sm:grid-cols-3 sm:gap-6">
              <ImpactDonut
                savedPct={55}
                label="AI-eligible"
                sub="Share of tickets that can take a warm-start draft after triage."
                delay={0.05}
              />
              <ImpactDonut
                savedPct={72}
                label="PII cleared"
                sub="Payloads that never reach a model until clearing policy passes."
                delay={0.15}
              />
              <ImpactDonut
                savedPct={100}
                label="Human review"
                sub="Every draft still needs your review — agents propose, you ship."
                delay={0.25}
              />
            </div>

            <motion.div
              className="mt-12 rounded-2xl border border-outline-variant/70 bg-surface-container-low/60 px-5 py-6 sm:px-8 sm:py-8"
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
                    Example week · 40 tickets
                  </p>
                  <p className="mt-2 font-serif text-5xl tracking-tight text-on-surface sm:text-6xl">
                    27.5h
                  </p>
                  <p className="mt-1 text-base text-on-surface-variant">warm-start capacity / week</p>
                </div>
                <div className="min-w-0 flex-1 sm:max-w-md">
                  <div className="flex h-3 overflow-hidden rounded-full bg-surface-container">
                    <motion.div
                      className="bg-mint"
                      initial={{ width: 0 }}
                      whileInView={{ width: '55%' }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                    />
                    <motion.div
                      className="bg-primary"
                      initial={{ width: 0 }}
                      whileInView={{ width: '30%' }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.9, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
                    />
                    <motion.div
                      className="bg-butter"
                      initial={{ width: 0 }}
                      whileInView={{ width: '15%' }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.9, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-on-surface-variant">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-mint" /> AI draft
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-primary" /> Human path
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-butter" /> Blocked / review
                    </span>
                  </div>
                </div>
              </div>
              <p className="mt-5 text-sm text-on-surface-variant">
                Tune the sliders in the{' '}
                <Link to="/blog" className="font-semibold text-primary hover:underline">
                  Impact explorer
                </Link>
                .
              </p>
            </motion.div>
          </section>

          <PlatformsSurfaces teaser />

          <ConnectionSurfaces teaser />

          <HowItWorks variant="compact" autoAdvance />

          <section className="border-t border-outline-variant/60 py-14 sm:py-16" aria-labelledby="who-heading">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-semibold tracking-tight text-primary">Who it’s for</p>
              <h2 id="who-heading" className="mt-2 font-serif text-3xl tracking-tight sm:text-4xl">
                Owners govern. Leads triage. Contributors review.
              </h2>
            </div>
            <div className="mt-10 grid gap-8 sm:grid-cols-3">
              {[
                {
                  role: 'Workspace owner',
                  body: 'Policies, model preference, connections, and who can join.',
                },
                {
                  role: 'Delivery lead',
                  body: 'Swipe AI vs human, approve ticket and model MRs, ship skills from answer groups.',
                },
                {
                  role: 'Contributor',
                  body: 'Try the custom model and use governed skills — never shadow agents outside the path.',
                },
              ].map((item, i) => (
                <motion.div
                  key={item.role}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.06, duration: 0.4 }}
                >
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
                    Seat
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-on-surface">{item.role}</h3>
                  <p className="mt-2 text-sm leading-6 text-on-surface-variant">{item.body}</p>
                </motion.div>
              ))}
            </div>
          </section>

          <section className="border-t border-outline-variant/60 py-16 text-center sm:pb-20 sm:pt-20">
            <p className="text-sm font-semibold tracking-tight text-primary">Ready?</p>
            <h2 className="mt-2 font-serif text-3xl tracking-tight sm:text-4xl">
              Start a free workspace
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-base leading-7 text-on-surface-variant">
              Connect your stack, triage, set PII rules, and review a draft in a live free workspace.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link to="/signup">
                <Button variant="primary">
                  Start free <ArrowRight size={16} />
                </Button>
              </Link>
              <Link to="/login">
                <Button variant="secondary">Log in</Button>
              </Link>
              <Link to="/pricing">
                <Button variant="quiet">Compare plans</Button>
              </Link>
            </div>
          </section>
        </MarketingWidth>
      </div>
    </MarketingShell>
  );
}
