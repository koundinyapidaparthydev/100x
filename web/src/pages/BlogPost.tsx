import { Link, Navigate, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '../components/ui';
import { MarketingShell, MarketingWidth } from '../components/landing';
import { getPost, type BlogSection } from '../lib/blogPosts';

function SectionBlock({ section }: { section: BlogSection }) {
  if (section.type === 'p') {
    return <p className="text-base leading-8 text-on-surface sm:text-lg sm:leading-9">{section.text}</p>;
  }
  if (section.type === 'h2') {
    return (
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-on-surface sm:text-3xl">
        {section.text}
      </h2>
    );
  }
  if (section.type === 'ul') {
    return (
      <ul className="space-y-2 text-base leading-7 text-on-surface sm:text-lg sm:leading-8">
        {section.items.map((item) => (
          <li key={item} className="flex gap-3">
            <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    );
  }
  if (section.type === 'callout') {
    return (
      <aside className="rounded-2xl bg-butter-container/70 px-5 py-4 text-on-butter-container sm:px-6 sm:py-5">
        <p className="text-sm font-semibold tracking-tight">{section.title}</p>
        <p className="mt-2 text-base leading-7">{section.text}</p>
      </aside>
    );
  }
  return (
    <div className="overflow-x-auto">
      <p className="mb-3 text-sm font-semibold text-on-surface-variant">{section.caption}</p>
      <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-outline-variant/60">
            {section.headers.map((header) => (
              <th key={header} className="px-2 py-3 font-semibold text-on-surface first:pl-0 last:pr-0">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {section.rows.map((row) => (
            <tr key={row.join('|')} className="border-b border-outline-variant/40 align-top">
              {row.map((cell, i) => (
                <td
                  key={`${cell}-${i}`}
                  className="px-2 py-3 leading-6 text-on-surface-variant first:pl-0 first:font-semibold first:text-on-surface last:pr-0"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const post = slug ? getPost(slug) : undefined;

  if (!post) {
    return <Navigate to="/blog" replace />;
  }

  return (
    <MarketingShell testId="blog-post-page">
      <MarketingWidth as="main">
        <article className="mx-auto max-w-2xl py-10 sm:py-14">
          <Link
            to="/blog"
            className="inline-flex items-center gap-1 text-sm font-semibold text-on-surface-variant hover:text-on-surface"
          >
            <ArrowLeft size={14} /> All articles
          </Link>

          <motion.header
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="mt-8"
          >
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
                {post.date}
              </p>
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
                {post.topicLabel}
              </p>
              <p className="text-xs text-on-surface-variant">{post.readingMinutes} min read</p>
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl sm:leading-tight">
              {post.title}
            </h1>
            <p className="mt-4 text-lg leading-8 text-on-surface-variant">{post.excerpt}</p>
            <p className="mt-4 rounded-2xl bg-mint-container/70 px-4 py-3 text-sm leading-6 text-on-mint-container sm:text-base">
              <span className="font-semibold">Impact: </span>
              {post.impact}
            </p>
          </motion.header>

          <div className="mt-10 space-y-8">
            {post.sections.map((section, index) => (
              <motion.div
                key={`${section.type}-${index}`}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.35 }}
                transition={{ duration: 0.4 }}
              >
                <SectionBlock section={section} />
              </motion.div>
            ))}
          </div>

          <div className="mt-14 flex flex-col items-start gap-3 border-t border-outline-variant/60 pt-10 sm:flex-row sm:items-center sm:justify-between">
            <Link to="/blog" className="text-sm font-semibold text-on-surface-variant hover:text-on-surface">
              ← Back to blog
            </Link>
            <Link to="/signup">
              <Button variant="primary">
                Try the workspace <ArrowRight size={16} />
              </Button>
            </Link>
          </div>
        </article>
      </MarketingWidth>
    </MarketingShell>
  );
}
