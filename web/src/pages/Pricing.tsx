import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import { Button, Card } from '../components/ui';
import { MarketingShell } from '../components/landing';

const PLANS = [
  {
    id: 'demo',
    name: 'Demo workspace',
    price: 'Free',
    blurb: 'Explore the full flow with seeded projects and role-based access.',
    featured: true,
    cta: 'Enter the demo',
    href: '/signup',
    features: [
      'Connect and sync sample Jira projects',
      'Manager, Founder, and Engineer roles',
      'Triage, AI drafts, approvals, and audit',
      'PII firewall and policy surfaces',
    ],
  },
  {
    id: 'team',
    name: 'Team',
    price: 'Contact',
    blurb: 'Governed AI-first delegation for a delivery org — policies, budgets, and audit.',
    featured: false,
    cta: 'Talk to us',
    href: '/signup',
    features: [
      'Org policy defaults and project overrides',
      'Model, cloud, and token budget controls',
      'Web control plane + mobile triage',
      'SSO and production identity (roadmap)',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Contact',
    blurb: 'Private cloud options, stricter security layers, and customer-owned runtimes.',
    featured: false,
    cta: 'Talk to us',
    href: '/signup',
    features: [
      'Customer VPC / private cloud paths',
      'Hardened PII and attachment allowlists',
      'Compliance-oriented audit exports',
      'Dedicated onboarding',
    ],
  },
] as const;

export default function Pricing() {
  return (
    <MarketingShell testId="pricing-page">
      <main className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <header className="mx-auto max-w-2xl py-10 text-center sm:py-14">
          <p className="text-sm font-semibold tracking-tight text-primary">Pricing</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
            Start in the demo. Scale with governance.
          </h1>
          <p className="mt-4 text-base leading-7 text-on-surface-variant sm:text-lg sm:leading-8">
            This build ships a free demo workspace. Team and enterprise packaging is illustrative —
            production billing is not configured here.
          </p>
        </header>

        <div className="mx-auto grid max-w-5xl gap-5 pb-8 md:grid-cols-3">
          {PLANS.map((plan, index) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.5, delay: index * 0.06 }}
            >
              <Card
                hierarchy={plan.featured ? 'primary' : 'secondary'}
                tone={plan.featured ? 'mint' : 'default'}
                className="flex h-full flex-col"
                title={plan.name}
                description={plan.blurb}
              >
                <p className="text-3xl font-semibold tracking-tight text-on-surface">{plan.price}</p>
                <ul className="mt-5 flex-1 space-y-2.5 text-sm text-on-surface-variant">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2">
                      <Check size={16} className="mt-0.5 shrink-0 text-mint" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link to={plan.href} className="mt-6 block">
                  <Button variant={plan.featured ? 'primary' : 'secondary'} className="w-full">
                    {plan.cta} <ArrowRight size={16} />
                  </Button>
                </Link>
              </Card>
            </motion.div>
          ))}
        </div>

        <p className="mx-auto max-w-2xl pb-16 text-center text-xs text-on-surface-variant">
          Demo authentication only. Production identity, SSO, and billing are not configured in this
          repository.
        </p>
      </main>
    </MarketingShell>
  );
}
