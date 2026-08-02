import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '../components/ui';
import {
  ConnectionSurfaces,
  DataCleanupDemo,
  HowItWorks,
  MarketingShell,
  MarketingWidth,
  PipelineFlow,
} from '../components/landing';
import { getService, MARKETING_SURFACE_IDS, marketingAvailability } from '../lib/serviceCatalog';

export default function HowItWorksPage() {
  return (
    <MarketingShell testId="how-it-works-page">
      <header className="py-10 text-center sm:py-14">
        <MarketingWidth>
          <div className="mx-auto max-w-2xl">
            <p className="text-sm font-semibold tracking-tight text-primary">How it works</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
              From connected ticket to reviewed draft
            </h1>
            <p className="mt-4 text-base leading-7 text-on-surface-variant sm:text-lg sm:leading-8">
              Connect boards and channels, sync a queue, triage AI vs human, clear PII, run in the
              cloud you choose, then approve with an audit trail.
            </p>
          </div>
        </MarketingWidth>
      </header>

      <PipelineFlow />

      <MarketingWidth as="main">
        <HowItWorks autoAdvance showTimeline={false} />

        <div className="border-t border-outline-variant/60">
          <ConnectionSurfaces />
        </div>

        <div className="border-t border-outline-variant/60">
          <DataCleanupDemo />
        </div>

        <section
          className="border-t border-outline-variant/60 py-16 sm:py-20"
          aria-labelledby="agents-fit-heading"
        >
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold tracking-tight text-primary">Where agents fit</p>
            <h2
              id="agents-fit-heading"
              className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl"
            >
              ChatGPT, Codex, Claude Code — after connect
            </h2>
            <p className="mt-3 text-base leading-7 text-on-surface-variant">
              Agent clients pull ticket stats and cleared context once connected. They sit beside
              the clean and review stages — never ahead of PII clearing. All Coming until OAuth
              ships.
            </p>
          </div>
          <ul className="mx-auto mt-8 flex max-w-lg flex-col gap-2">
            {MARKETING_SURFACE_IDS.agents.map((id) => {
              const svc = getService(id);
              if (!svc) return null;
              return (
                <li
                  key={id}
                  className="flex items-center gap-3 border border-outline-variant/60 bg-surface-container-lowest px-3 py-2.5"
                >
                  <img src={svc.logo} alt="" className="h-7 w-7 rounded-lg" />
                  <span className="text-sm font-semibold text-on-surface">{svc.name}</span>
                  <span className="ml-auto text-[11px] font-semibold uppercase tracking-[0.06em] text-on-surface-variant">
                    {marketingAvailability(svc)}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 border-t border-outline-variant/60 pb-10 pt-16 text-center">
          <p className="text-base text-on-surface-variant">Ready to walk the flow yourself?</p>
          <Link to="/signup">
            <Button variant="primary">
              Start free <ArrowRight size={16} />
            </Button>
          </Link>
        </div>
      </MarketingWidth>
    </MarketingShell>
  );
}
