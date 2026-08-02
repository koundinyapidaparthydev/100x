import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronDown, Search, X } from 'lucide-react';
import { Button } from '../components/ui';
import { MarketingShell, MarketingWidth } from '../components/landing';
import { searchPosts, type BlogTopic } from '../lib/blogPosts';

const CATEGORY_OPTIONS: { id: BlogTopic | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'enterprise', label: 'Enterprise' },
  { id: 'open-source', label: 'Open source' },
  { id: 'workflow', label: 'Workflow' },
  { id: 'comparison', label: 'Comparison' },
];

function ImpactExplorer() {
  const [tickets, setTickets] = useState(40);
  const [eligible, setEligible] = useState(55);
  const [hoursSaved, setHoursSaved] = useState(1.25);

  const weeklyHours = useMemo(
    () => Math.round(tickets * (eligible / 100) * hoursSaved * 10) / 10,
    [tickets, eligible, hoursSaved],
  );
  const yearlyHours = useMemo(() => Math.round(weeklyHours * 48), [weeklyHours]);

  /** Soft bar fill: weekly as share of a 80h planning ceiling; yearly scaled for visual rhythm. */
  const weeklyBar = Math.min(100, (weeklyHours / 80) * 100);
  const yearlyBar = Math.min(100, (yearlyHours / 2400) * 100);

  return (
    <section
      className="border-y border-outline-variant/60 py-10 sm:py-12"
      data-testid="blog-impact-explorer"
      aria-labelledby="impact-explorer-heading"
    >
      <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
        <div className="max-w-xl">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
            Interactive
          </p>
          <h2 id="impact-explorer-heading" className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            Impact explorer
          </h2>
          <p className="mt-2 text-base leading-7 text-on-surface-variant">
            Sketch warmer-start hours from your board volume. Directional planning only — not a promise.
          </p>
        </div>

        <motion.div
          key={`${weeklyHours}-${yearlyHours}`}
          initial={{ opacity: 0.45, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="grid min-w-0 flex-1 gap-5 sm:grid-cols-2"
        >
          <div>
            <p className="text-sm font-semibold text-on-surface-variant">Warm start / week</p>
            <p className="mt-1 font-serif text-5xl tracking-tight text-on-surface sm:text-6xl">
              {weeklyHours}
              <span className="text-3xl text-on-surface-variant sm:text-4xl">h</span>
            </p>
            <div
              className="mt-4 h-2.5 overflow-hidden rounded-full bg-surface-container"
              aria-hidden
            >
              <motion.div
                className="h-full rounded-full bg-primary/80"
                initial={false}
                animate={{ width: `${weeklyBar}%` }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
              />
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-on-surface-variant">≈ hours / year (48 wks)</p>
            <p className="mt-1 font-serif text-5xl tracking-tight text-on-surface sm:text-6xl">
              {yearlyHours}
              <span className="text-3xl text-on-surface-variant sm:text-4xl">h</span>
            </p>
            <div
              className="mt-4 h-2.5 overflow-hidden rounded-full bg-surface-container"
              aria-hidden
            >
              <motion.div
                className="h-full rounded-full bg-mint/90"
                initial={false}
                animate={{ width: `${yearlyBar}%` }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
              />
            </div>
          </div>
        </motion.div>
      </div>

      {/* Soft area viz: weekly → yearly scale */}
      <div className="relative mt-8 overflow-hidden rounded-2xl bg-surface-container/50 px-4 pb-3 pt-5 sm:px-6">
        <svg
          viewBox="0 0 640 120"
          className="h-24 w-full text-primary sm:h-28"
          role="img"
          aria-label={`About ${weeklyHours} hours per week scales to roughly ${yearlyHours} hours per year`}
        >
          <defs>
            <linearGradient id="impact-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {/* Baseline grid */}
          <line x1="0" y1="100" x2="640" y2="100" stroke="currentColor" strokeOpacity="0.12" />
          <line x1="0" y1="60" x2="640" y2="60" stroke="currentColor" strokeOpacity="0.06" strokeDasharray="4 6" />
          {/* Soft area from week (left) growing toward year (right) */}
          <path
            d={`M0 100 L0 ${100 - weeklyBar * 0.7} C160 ${100 - weeklyBar * 0.85}, 320 ${100 - yearlyBar * 0.55}, 640 ${100 - yearlyBar * 0.85} L640 100 Z`}
            fill="url(#impact-area)"
          />
          <path
            d={`M0 ${100 - weeklyBar * 0.7} C160 ${100 - weeklyBar * 0.85}, 320 ${100 - yearlyBar * 0.55}, 640 ${100 - yearlyBar * 0.85}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeOpacity="0.55"
          />
          <text x="8" y="16" fill="currentColor" fillOpacity="0.55" fontSize="11">
            Week
          </text>
          <text x="600" y="16" textAnchor="end" fill="currentColor" fillOpacity="0.55" fontSize="11">
            Year
          </text>
        </svg>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3 sm:gap-6">
        <label className="block">
          <span className="flex items-baseline justify-between gap-2 text-sm font-semibold text-on-surface">
            Tickets / week
            <span className="font-mono text-xs font-medium text-on-surface-variant">{tickets}</span>
          </span>
          <input
            type="range"
            min={10}
            max={200}
            value={tickets}
            onChange={(e) => setTickets(Number(e.target.value))}
            className="mt-2 h-1.5 w-full accent-[var(--color-primary)]"
          />
        </label>
        <label className="block">
          <span className="flex items-baseline justify-between gap-2 text-sm font-semibold text-on-surface">
            AI-eligible %
            <span className="font-mono text-xs font-medium text-on-surface-variant">{eligible}%</span>
          </span>
          <input
            type="range"
            min={10}
            max={90}
            value={eligible}
            onChange={(e) => setEligible(Number(e.target.value))}
            className="mt-2 h-1.5 w-full accent-[var(--color-primary)]"
          />
        </label>
        <label className="block">
          <span className="flex items-baseline justify-between gap-2 text-sm font-semibold text-on-surface">
            Hours / eligible ticket
            <span className="font-mono text-xs font-medium text-on-surface-variant">{hoursSaved}h</span>
          </span>
          <input
            type="range"
            min={0.25}
            max={4}
            step={0.25}
            value={hoursSaved}
            onChange={(e) => setHoursSaved(Number(e.target.value))}
            className="mt-2 h-1.5 w-full accent-[var(--color-primary)]"
          />
        </label>
      </div>
    </section>
  );
}

function ArticleToolbar({
  query,
  setQuery,
  topic,
  setTopic,
}: {
  query: string;
  setQuery: (value: string) => void;
  topic: BlogTopic | 'all';
  setTopic: (value: BlogTopic | 'all') => void;
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const expanded = searchOpen || query.length > 0;

  useEffect(() => {
    if (expanded) inputRef.current?.focus();
  }, [expanded]);

  useEffect(() => {
    if (!expanded) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node) && query.length === 0) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [expanded, query]);

  const topicLabel = CATEGORY_OPTIONS.find((item) => item.id === topic)?.label ?? 'All';

  return (
    <div className="mt-6 flex flex-wrap items-center gap-2 sm:gap-3">
      <div ref={wrapRef} className={`relative min-w-0 ${expanded ? 'w-full sm:flex-1' : ''}`}>
        {!expanded && (
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-outline-variant bg-surface text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Search articles"
          >
            <Search size={18} aria-hidden />
          </button>
        )}
        <label className={expanded ? 'relative block w-full' : 'sr-only'}>
          <span className="sr-only">Search articles</span>
          {expanded && (
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
              aria-hidden
            />
          )}
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setSearchOpen(true)}
            onBlur={() => {
              if (query.length === 0) setSearchOpen(false);
            }}
            placeholder="Search impact, PII, open source, Devin…"
            data-testid="blog-search"
            className={
              expanded
                ? 'w-full rounded-lg border border-outline-variant bg-surface py-2.5 pl-10 pr-10 text-sm text-on-surface placeholder:text-on-surface-variant/70 focus:outline-none focus:ring-2 focus:ring-primary'
                : undefined
            }
            tabIndex={expanded ? 0 : -1}
          />
          {expanded && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setSearchOpen(false);
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
              aria-label="Close search"
            >
              <X size={14} aria-hidden />
            </button>
          )}
        </label>
      </div>

      <label className={`relative inline-flex shrink-0 ${expanded ? 'w-full sm:w-auto' : ''}`}>
        <span className="sr-only">Filter by category</span>
        <select
          value={topic}
          onChange={(e) => setTopic(e.target.value as BlogTopic | 'all')}
          className="h-10 appearance-none rounded-lg border border-outline-variant bg-surface py-2 pl-3 pr-9 text-sm font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
          aria-label="Filter by category"
        >
          {CATEGORY_OPTIONS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={14}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
          aria-hidden
        />
        <span className="sr-only">Current category: {topicLabel}</span>
      </label>
    </div>
  );
}

export default function Blog() {
  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState<BlogTopic | 'all'>('all');
  const posts = useMemo(() => searchPosts(query, topic), [query, topic]);

  return (
    <MarketingShell testId="blog-page">
      <MarketingWidth as="main">
        <header className="mx-auto max-w-2xl py-10 text-center sm:py-14">
          <p className="text-sm font-semibold tracking-tight text-primary">Blog</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
            Impact, not AI stickers
          </h1>
          <p className="mt-4 text-base leading-7 text-on-surface-variant sm:text-lg sm:leading-8">
            What we are building, who it changes outcomes for, and how it compares to IDE assistants and
            autonomous agents — with an interactive impact model you can tune now.
          </p>
        </header>

        <ImpactExplorer />

        <section className="border-t border-outline-variant/60 py-10 sm:py-12" aria-labelledby="articles-heading">
          <div>
            <h2 id="articles-heading" className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Articles
            </h2>
            <p className="mt-2 max-w-2xl text-base leading-7 text-on-surface-variant">
              Search enterprise, open source, workflow, and comparison pieces. Full articles — not “coming soon.”
            </p>

            <ArticleToolbar query={query} setQuery={setQuery} topic={topic} setTopic={setTopic} />

            <ul className="mt-8 grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
              {posts.length === 0 && (
                <li className="col-span-full py-10 text-center text-on-surface-variant">
                  No articles match. Try another topic or clear search.
                </li>
              )}
              {posts.map((post, index) => (
                <motion.li
                  key={post.slug}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.4, delay: index * 0.03 }}
                >
                  <Link
                    to={`/blog/${post.slug}`}
                    className="group flex h-full flex-col rounded-2xl border border-outline-variant/70 bg-surface-container/40 p-5 transition-colors hover:border-outline-variant hover:bg-surface-container/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:p-6"
                  >
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
                        {post.topicLabel}
                      </p>
                      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
                        {post.date}
                      </p>
                      <p className="text-xs text-on-surface-variant">{post.readingMinutes} min read</p>
                    </div>
                    <h3 className="mt-3 text-lg font-semibold tracking-tight text-on-surface group-hover:text-primary sm:text-xl">
                      {post.title}
                    </h3>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-on-surface-variant sm:text-base sm:leading-7">
                      {post.excerpt}
                    </p>
                    <p className="mt-auto pt-4 text-sm leading-6 text-on-surface">
                      <span className="font-semibold">Impact: </span>
                      {post.impact}
                    </p>
                    <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary">
                      Read article <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </Link>
                </motion.li>
              ))}
            </ul>
          </div>
        </section>

        <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 border-t border-outline-variant/60 pb-10 pt-16 text-center">
          <p className="text-base text-on-surface-variant">Prefer the product over the essay?</p>
          <Link to="/signup">
            <Button variant="primary">
              Sign up <ArrowRight size={16} />
            </Button>
          </Link>
        </div>
      </MarketingWidth>
    </MarketingShell>
  );
}
