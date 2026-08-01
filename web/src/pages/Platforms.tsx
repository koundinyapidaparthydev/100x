import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { ArrowRight, Monitor, Smartphone } from 'lucide-react';
import { Button } from '../components/ui';
import { MarketingShell } from '../components/landing';

const PLATFORMS = [
  {
    id: 'web',
    title: 'Web control plane',
    eyebrow: 'Depth',
    icon: <Monitor size={28} strokeWidth={1.6} />,
    body: 'Connect boards, set policies, inspect AI drafts and artifacts, manage PII rules, runtime, and audit — the full configuration and review surface.',
    points: [
      'Project connect and sync health',
      'Work queues, ticket detail, and evidence',
      'Governance: defaults, PII, models, cloud',
      'Approvals and searchable audit trail',
    ],
    tone: 'bg-primary-container text-on-primary-container',
  },
  {
    id: 'mobile',
    title: 'Mobile triage',
    eyebrow: 'Speed',
    icon: <Smartphone size={28} strokeWidth={1.6} />,
    body: 'Managers decide AI-first vs human-first away from the desk. Swipe to send work to AI or assign a person; tap for status and approvals.',
    points: [
      'Swipe right: Send to AI',
      'Swipe left: Assign to person',
      'Approvals and notifications on the go',
      'Deep config stays on web',
    ],
    tone: 'bg-mint-container text-on-mint-container',
  },
] as const;

export default function Platforms() {
  return (
    <MarketingShell testId="platforms-page">
      <main className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <header className="mx-auto max-w-2xl py-10 text-center sm:py-14">
          <p className="text-sm font-semibold tracking-tight text-primary">Platforms</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
            One agent. Two screens.
          </h1>
          <p className="mt-4 text-base leading-7 text-on-surface-variant sm:text-lg sm:leading-8">
            Web for configuration and deep review. Mobile for fast triage. Same governed path —
            different jobs.
          </p>
        </header>

        <div className="mx-auto grid max-w-4xl gap-10 pb-16 sm:gap-14">
          {PLATFORMS.map((platform, index) => (
            <motion.article
              key={platform.id}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.35 }}
              transition={{ duration: 0.55, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
              className="grid gap-6 sm:grid-cols-[auto_1fr] sm:gap-8"
            >
              <div
                className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${platform.tone}`}
              >
                {platform.icon}
              </div>
              <div className="min-w-0">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
                  {platform.eyebrow}
                </p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{platform.title}</h2>
                <p className="mt-3 max-w-xl text-base leading-7 text-on-surface-variant">{platform.body}</p>
                <ul className="mt-5 space-y-2 text-sm text-on-surface">
                  {platform.points.map((point) => (
                    <li key={point} className="flex gap-2">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.article>
          ))}
        </div>

        <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 border-t border-outline-variant/60 py-16 text-center">
          <p className="text-base text-on-surface-variant">Try the web workspace in a demo role.</p>
          <Link to="/signup">
            <Button variant="primary">
              Sign up <ArrowRight size={16} />
            </Button>
          </Link>
        </div>
      </main>
    </MarketingShell>
  );
}
