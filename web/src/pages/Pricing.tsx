import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  Link2,
  ShieldCheck,
  Sparkles,
  Eye,
  Minus,
  X,
} from 'lucide-react';
import { Button } from '../components/ui';
import { MarketingShell, MarketingWidth } from '../components/landing';

const VALUE_PATH = [
  { label: 'Connect', icon: Link2, detail: 'Boards & surfaces' },
  { label: 'Triage', icon: Sparkles, detail: 'AI vs human' },
  { label: 'Clear', icon: ShieldCheck, detail: 'PII firewall' },
  { label: 'Review', icon: Eye, detail: 'Review draft & ship' },
] as const;

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: 'Free',
    blurb: 'Live workspace: connect your stack, triage, PII rules, and reviewed drafts — models and skills after review.',
    featured: true,
    cta: 'Start free',
    href: '/signup',
    highlights: [
      'Connect boards and open Connections',
      'Triage AI vs human on web and mobile',
      'PII firewall and policy surfaces',
      'Reviewed drafts; models and skills after human review',
    ],
  },
  {
    id: 'team',
    name: 'Team',
    price: 'Contact',
    blurb: 'Org policies, budgets, SSO, and more seats for a delivery org.',
    featured: false,
    cta: 'Talk to us',
    href: '/signup',
    highlights: [
      'Org policy defaults and project overrides',
      'Model, cloud, and token budget controls',
      'SSO and production identity',
      'Additional seats for the delivery org',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Contact',
    blurb: 'Private cloud, stricter clearing, and dedicated onboarding.',
    featured: false,
    cta: 'Talk to us',
    href: '/signup',
    highlights: [
      'Customer VPC / private cloud paths',
      'Hardened PII and attachment allowlists',
      'Compliance-oriented audit exports',
      'Dedicated onboarding',
    ],
  },
] as const;

type Cell = 'yes' | 'partial' | 'no' | string;

const MATRIX: Array<{
  capability: string;
  free: Cell;
  team: Cell;
  enterprise: Cell;
}> = [
  {
    capability: 'Connect → triage → clear → review',
    free: 'yes',
    team: 'yes',
    enterprise: 'yes',
  },
  {
    capability: 'Web + mobile triage surfaces',
    free: 'yes',
    team: 'yes',
    enterprise: 'yes',
  },
  {
    capability: 'PII firewall & policy surfaces',
    free: 'yes',
    team: 'yes',
    enterprise: 'Hardened allowlists',
  },
  {
    capability: 'Approvals & audit trail',
    free: 'yes',
    team: 'yes',
    enterprise: 'Compliance exports',
  },
  {
    capability: 'Seats',
    free: 'Starter workspace',
    team: 'Org seats',
    enterprise: 'Enterprise seats',
  },
  {
    capability: 'Org policies & budgets',
    free: 'no',
    team: 'yes',
    enterprise: 'yes',
  },
  {
    capability: 'SSO / production identity',
    free: 'no',
    team: 'yes',
    enterprise: 'yes',
  },
  {
    capability: 'Private cloud / customer VPC',
    free: 'no',
    team: 'no',
    enterprise: 'yes',
  },
  {
    capability: 'Dedicated onboarding',
    free: 'no',
    team: 'partial',
    enterprise: 'yes',
  },
];

function CellValue({ value }: { value: Cell }) {
  if (value === 'yes') {
    return (
      <span className="inline-flex items-center justify-center text-mint" aria-label="Included">
        <Check size={18} strokeWidth={2.25} />
      </span>
    );
  }
  if (value === 'no') {
    return (
      <span className="inline-flex items-center justify-center text-outline" aria-label="Not included">
        <X size={16} strokeWidth={2} />
      </span>
    );
  }
  if (value === 'partial') {
    return (
      <span
        className="inline-flex items-center justify-center text-on-surface-variant"
        aria-label="Limited"
      >
        <Minus size={16} strokeWidth={2.25} />
      </span>
    );
  }
  return <span className="text-sm leading-5 text-on-surface-variant">{value}</span>;
}

export default function Pricing() {
  return (
    <MarketingShell testId="pricing-page">
      <MarketingWidth as="main">
        <header className="py-10 sm:py-14">
          <div className="flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between lg:gap-16">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold tracking-tight text-primary">Pricing</p>
              <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
                Start free. Scale with governance.
              </h1>
              <p className="mt-4 text-base leading-7 text-on-surface-variant sm:text-lg sm:leading-8">
                Free is a live workspace — connect, triage, clear, and review a draft. Custom models
                and skills unlock after human review. Team and Enterprise add seats, SSO, and private
                cloud paths. No listed dollar amounts yet.
              </p>
            </div>

            <nav
              aria-label="What you get to build"
              className="w-full shrink-0 lg:max-w-xl"
            >
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
                Value path
              </p>
              <ol className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-0">
                {VALUE_PATH.map((step, index) => {
                  const Icon = step.icon;
                  return (
                    <li key={step.label} className="relative flex items-stretch">
                      <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, amount: 0.4 }}
                        transition={{ duration: 0.4, delay: index * 0.05 }}
                        className="flex w-full flex-col items-start gap-1.5 rounded-lg bg-surface-container px-3 py-3 sm:rounded-none sm:bg-transparent sm:px-0 sm:py-0"
                      >
                        <span className="inline-flex size-8 items-center justify-center rounded-lg bg-surface-container-high text-primary sm:bg-surface-container">
                          <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
                        </span>
                        <span className="text-sm font-semibold tracking-tight text-on-surface">
                          {step.label}
                        </span>
                        <span className="text-xs text-on-surface-variant">{step.detail}</span>
                      </motion.div>
                      {index < VALUE_PATH.length - 1 ? (
                        <span
                          className="pointer-events-none absolute right-0 top-7 hidden h-px w-full translate-x-1/2 bg-outline-variant sm:block"
                          aria-hidden="true"
                        />
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            </nav>
          </div>
        </header>

        <section aria-labelledby="plans-heading" className="pb-14">
          <h2 id="plans-heading" className="sr-only">
            Plans
          </h2>
          <div className="grid gap-4 md:grid-cols-3 md:gap-5">
            {PLANS.map((plan, index) => (
              <motion.article
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{ duration: 0.45, delay: index * 0.06 }}
                className={`flex flex-col rounded-xl border p-6 sm:p-7 ${
                  plan.featured
                    ? 'border-mint/50 bg-surface-container-low shadow-card ring-1 ring-mint/30'
                    : 'border-outline-variant/70 bg-surface-container-lowest'
                }`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-semibold tracking-tight text-on-surface">{plan.name}</p>
                  {plan.featured ? (
                    <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-mint">
                      Featured
                    </span>
                  ) : null}
                </div>
                <p className="mt-3 text-3xl font-semibold tracking-tight text-on-surface sm:text-4xl">
                  {plan.price}
                </p>
                <p className="mt-3 text-sm leading-6 text-on-surface-variant">{plan.blurb}</p>
                <ul className="mt-6 flex-1 space-y-2.5 text-sm text-on-surface-variant">
                  {plan.highlights.map((feature) => (
                    <li key={feature} className="flex gap-2.5">
                      <Check size={16} className="mt-0.5 shrink-0 text-mint" aria-hidden="true" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link to={plan.href} className="mt-8 block">
                  <Button variant={plan.featured ? 'primary' : 'secondary'} className="w-full">
                    {plan.cta} <ArrowRight size={16} />
                  </Button>
                </Link>
              </motion.article>
            ))}
          </div>
        </section>

        <section className="border-t border-outline-variant/60 py-12 sm:py-14" aria-labelledby="matrix-heading">
          <div className="mb-8 max-w-2xl">
            <h2 id="matrix-heading" className="text-xl font-semibold tracking-tight sm:text-2xl">
              Feature matrix
            </h2>
            <p className="mt-2 text-sm leading-6 text-on-surface-variant sm:text-base">
              Compare capabilities across Free, Team, and Enterprise — seats, SSO, and VPC paths
              without invented prices.
            </p>
          </div>

          <div className="overflow-x-auto rounded-xl border border-outline-variant/70 bg-surface-container-lowest">
            <table className="w-full min-w-[40rem] border-collapse text-left">
              <thead>
                <tr className="border-b border-outline-variant/70 bg-surface-container">
                  <th
                    scope="col"
                    className="px-4 py-3.5 text-xs font-semibold uppercase tracking-[0.08em] text-on-surface-variant sm:px-5"
                  >
                    Capability
                  </th>
                  {(['Free', 'Team', 'Enterprise'] as const).map((col) => (
                    <th
                      key={col}
                      scope="col"
                      className={`px-4 py-3.5 text-center text-sm font-semibold tracking-tight sm:px-5 ${
                        col === 'Free' ? 'bg-mint/10 text-on-surface' : 'text-on-surface'
                      }`}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MATRIX.map((row, rowIndex) => (
                  <tr
                    key={row.capability}
                    className={
                      rowIndex < MATRIX.length - 1
                        ? 'border-b border-outline-variant/50'
                        : undefined
                    }
                  >
                    <th
                      scope="row"
                      className="px-4 py-3.5 text-sm font-medium text-on-surface sm:px-5"
                    >
                      {row.capability}
                    </th>
                    <td className="bg-mint/5 px-4 py-3.5 text-center sm:px-5">
                      <CellValue value={row.free} />
                    </td>
                    <td className="px-4 py-3.5 text-center sm:px-5">
                      <CellValue value={row.team} />
                    </td>
                    <td className="px-4 py-3.5 text-center sm:px-5">
                      <CellValue value={row.enterprise} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <p className="mx-auto max-w-2xl pb-12 text-center text-xs leading-5 text-on-surface-variant">
          Paid billing is contact-sales for now. Production SSO is available when identity providers
          are configured on the backend. Free opens a live workspace until billing exists.
        </p>
      </MarketingWidth>
    </MarketingShell>
  );
}
