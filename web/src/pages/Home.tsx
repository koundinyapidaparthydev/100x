import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { readDemoSession } from '../lib/session';
import { Button } from '../components/ui';
import { HeroVisual, HowItWorks, MarketingShell } from '../components/landing';

export default function Home() {
  if (readDemoSession()) {
    return <Navigate to="/projects" replace />;
  }

  return (
    <MarketingShell testId="home-page">
      <div className="pb-10">
        <header className="relative mx-auto w-full max-w-6xl px-4 pb-10 pt-6 sm:px-6 lg:px-8 lg:pt-10">
          <motion.div
            className="mx-auto max-w-3xl text-center lg:mx-0 lg:max-w-2xl lg:text-left"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="font-serif text-4xl tracking-tight text-on-surface sm:text-5xl lg:text-6xl">
              AplifyAI
            </p>
            <h1 className="mt-5 text-3xl font-semibold tracking-tight text-on-surface sm:text-4xl lg:text-[2.85rem] lg:leading-[1.12]">
              Decide what happens to each work item.
            </h1>
            <p className="mt-4 text-base leading-7 text-on-surface-variant sm:text-lg sm:leading-8">
              Connect Jira, triage AI vs human, run drafts behind a PII firewall, and review before
              anything moves forward.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
              <Link to="/signup">
                <Button variant="primary">
                  Sign up <ArrowRight size={16} />
                </Button>
              </Link>
              <Link to="/how-it-works">
                <Button variant="secondary">See how it works</Button>
              </Link>
            </div>
            <p className="mt-3 text-sm text-on-surface-variant">Demo roles. No card required.</p>
          </motion.div>

          <motion.div
            className="mt-12 lg:mt-14"
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
          >
            <HeroVisual />
          </motion.div>
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          <HowItWorks />

          <section className="border-t border-outline-variant/60 py-16 text-center sm:py-24">
            <p className="text-sm font-semibold tracking-tight text-primary">Ready to try it?</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              Open a demo session
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-base leading-7 text-on-surface-variant">
              Sign up for a temporary workspace, or log in if you already know which role you want.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link to="/signup">
                <Button variant="primary">
                  Sign up <ArrowRight size={16} />
                </Button>
              </Link>
              <Link to="/login">
                <Button variant="secondary">Log in</Button>
              </Link>
            </div>
          </section>
        </main>
      </div>
    </MarketingShell>
  );
}
