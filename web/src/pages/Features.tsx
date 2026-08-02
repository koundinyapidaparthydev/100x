import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '../components/ui';
import {
  MarketingShell,
  MarketingWidth,
  ModelsSkillsTimeline,
} from '../components/landing';

export default function Features() {
  return (
    <MarketingShell testId="features-page">
      <MarketingWidth as="main">
        <header className="mx-auto max-w-2xl py-10 text-center sm:py-14">
          <p className="text-sm font-semibold tracking-tight text-primary">Features</p>
          <h1 className="mt-2 font-serif text-4xl tracking-tight text-on-surface sm:text-5xl">
            Data flow first. Models and skills after.
          </h1>
          <p className="mt-4 text-base leading-7 text-on-surface-variant sm:text-lg sm:leading-8">
            Cleared work becomes a reviewed draft, then a human-verified MR. Only then do we train a
            custom model you can call — and categorize skills your team installs in Cursor, Claude
            Code, and more.
          </p>
        </header>

        <ModelsSkillsTimeline showIntro={false} />

        <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 border-t border-outline-variant/60 pb-10 pt-14 text-center">
          <p className="text-base text-on-surface-variant">
            See the full path — reviewed drafts and models — with one human gate.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link to="/how-it-works">
              <Button variant="secondary">How it works</Button>
            </Link>
            <Link to="/signup">
              <Button variant="primary">
                Start free <ArrowRight size={16} />
              </Button>
            </Link>
          </div>
        </div>
      </MarketingWidth>
    </MarketingShell>
  );
}
