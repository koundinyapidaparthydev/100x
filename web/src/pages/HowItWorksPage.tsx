import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '../components/ui';
import { HowItWorks, MarketingShell } from '../components/landing';

export default function HowItWorksPage() {
  return (
    <MarketingShell testId="how-it-works-page">
      <main className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <header className="mx-auto max-w-2xl py-10 text-center sm:py-14">
          <p className="text-sm font-semibold tracking-tight text-primary">How it works</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
            From Jira ticket to reviewed draft
          </h1>
          <p className="mt-4 text-base leading-7 text-on-surface-variant sm:text-lg sm:leading-8">
            AplifyAI sits in front of human assignment: connect a board, set policy, triage each item,
            run AI behind a PII firewall, then review before work moves forward.
          </p>
        </header>

        <HowItWorks />

        <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 border-t border-outline-variant/60 py-16 text-center">
          <p className="text-base text-on-surface-variant">Ready to walk the flow yourself?</p>
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
