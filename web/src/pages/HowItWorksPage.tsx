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
  SKILL_PACKS,
} from '../components/landing';
import { getService, MARKETING_SURFACE_IDS, marketingAvailability } from '../lib/serviceCatalog';

export default function HowItWorksPage() {
  return (
    <MarketingShell testId="how-it-works-page">
      <header className="py-10 text-center sm:py-14">
        <MarketingWidth>
          <div className="mx-auto max-w-2xl">
            <p className="text-sm font-semibold tracking-tight text-primary">How it works</p>
            <h1 className="mt-2 font-serif text-4xl tracking-tight text-on-surface sm:text-5xl">
              Two paths. One draft review.
            </h1>
            <p className="mt-4 text-base leading-7 text-on-surface-variant sm:text-lg sm:leading-8">
              Ticket work clears PII and produces a reviewed draft. Custom models train on governed
              data, then open an MR only after a person approves — then skills reach your agent tools.
            </p>
          </div>
        </MarketingWidth>
      </header>

      <PipelineFlow />

      <MarketingWidth as="main">
        <HowItWorks autoAdvance />

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
              className="mt-2 font-serif text-3xl tracking-tight sm:text-4xl"
            >
              Skills from answer groups — after draft review
            </h2>
            <p className="mt-3 text-base leading-7 text-on-surface-variant">
              Agent clients pull cleared context once connected. Skill packs are built from curated
              answer categories after draft review so the platform keeps control. All Coming until
              OAuth ships.
            </p>
          </div>

          <div className="mx-auto mt-6 flex max-w-lg flex-wrap justify-center gap-2">
            {SKILL_PACKS.map((pack) => (
              <span
                key={pack.id}
                className="rounded-chip bg-butter-container px-2.5 py-1 text-[11px] font-semibold text-on-butter-container"
              >
                {pack.name}
              </span>
            ))}
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

          <p className="mt-6 text-center">
            <Link to="/platforms" className="text-sm font-semibold text-primary hover:underline">
              See skills on platforms →
            </Link>
          </p>
        </section>

        <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 border-t border-outline-variant/60 pb-10 pt-16 text-center">
          <p className="text-base text-on-surface-variant">Ready to review a draft yourself?</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link to="/features">
              <Button variant="secondary">Explore features</Button>
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
