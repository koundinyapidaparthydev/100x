import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '../components/ui';
import { MarketingShell } from '../components/landing';

const POSTS = [
  {
    slug: 'governed-ai-in-front-of-assignment',
    title: 'Put governed AI in front of human assignment',
    date: '2026-07-10',
    excerpt:
      'Why private AI on tickets creates inconsistent quality — and how a PII firewall plus triage changes the path.',
  },
  {
    slug: 'jira-stays-system-of-record',
    title: 'Jira stays the system of record',
    date: '2026-06-22',
    excerpt:
      'AplifyAI syncs work items and attaches drafts back to the board. We do not replace your issue tracker.',
  },
  {
    slug: 'mobile-swipe-triage',
    title: 'Mobile swipe triage for managers',
    date: '2026-06-02',
    excerpt:
      'Send to AI or assign to a person in one gesture — then review drafts and approvals when you are back at the desk.',
  },
  {
    slug: 'pii-before-the-model',
    title: 'PII never reaches the model by default',
    date: '2026-05-18',
    excerpt:
      'Sensitive fields can stop a job before execution. Approvals unlock the exception path with an audit trail.',
  },
] as const;

export default function Blog() {
  return (
    <MarketingShell testId="blog-page">
      <main className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <header className="mx-auto max-w-2xl py-10 text-center sm:py-14">
          <p className="text-sm font-semibold tracking-tight text-primary">Blog</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
            Notes on governed AI work
          </h1>
          <p className="mt-4 text-base leading-7 text-on-surface-variant sm:text-lg sm:leading-8">
            Short reads on triage, PII, and keeping the board as the system of record. Posts below are
            product notes for this demo — not a live CMS.
          </p>
        </header>

        <ul className="mx-auto max-w-2xl space-y-0 border-t border-outline-variant/60 pb-8">
          {POSTS.map((post, index) => (
            <motion.li
              key={post.slug}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.45, delay: index * 0.04 }}
              className="border-b border-outline-variant/60 py-8"
            >
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
                {post.date}
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-on-surface sm:text-2xl">
                {post.title}
              </h2>
              <p className="mt-2 text-base leading-7 text-on-surface-variant">{post.excerpt}</p>
              <p className="mt-3 text-sm font-semibold text-primary">Coming soon as a full article</p>
            </motion.li>
          ))}
        </ul>

        <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 border-t border-outline-variant/60 py-16 text-center">
          <p className="text-base text-on-surface-variant">Prefer hands-on over reading?</p>
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
