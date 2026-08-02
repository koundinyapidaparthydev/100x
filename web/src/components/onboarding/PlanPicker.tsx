import type { OnboardingPlan } from '@shared/types';
import { Building2, Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';

export type PlanPickerProps = {
  onSelect: (plan: OnboardingPlan) => void;
};

const PLANS: Array<{
  id: OnboardingPlan;
  title: string;
  body: string;
  meta: string;
  icon: typeof Sparkles;
}> = [
  {
    id: 'free',
    title: 'Free',
    body: 'Quick answers, then pick boards, chat, and code — open Connections.',
    meta: 'Quick start · stack & connections',
    icon: Sparkles,
  },
  {
    id: 'enterprise',
    title: 'Enterprise',
    body: 'Goals, full catalog, speed targets, and runtime — guided create-application.',
    meta: 'Full setup · catalog, targets & runtime',
    icon: Building2,
  },
];

export function PlanPicker({ onSelect }: PlanPickerProps) {
  return (
    <div className="mx-auto w-full max-w-4xl" data-testid="onboarding-plan-picker">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
        Create application
      </p>
      <h1 className="mt-1 text-xl font-semibold tracking-tight text-on-surface sm:text-2xl">
        Choose how you want to start
      </h1>
      <p className="mt-1 max-w-[65ch] text-xs leading-5 text-on-surface-variant sm:text-sm">
        Free for essentials. Enterprise for deeper governance and runtime setup. Okta when configured.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {PLANS.map((plan) => {
          const Icon = plan.icon;
          return (
            <button
              key={plan.id}
              type="button"
              data-testid={`onboarding-plan-${plan.id}`}
              onClick={() => onSelect(plan.id)}
              className={cn(
                'group flex min-h-[140px] flex-col rounded-card border border-outline-variant/80 bg-surface p-4 text-left shadow-card transition',
                'hover:border-primary/40 hover:bg-primary-container/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              )}
            >
              <span className="inline-flex size-9 items-center justify-center rounded-lg bg-primary-container text-on-primary-container transition group-hover:bg-primary group-hover:text-on-primary">
                <Icon size={18} aria-hidden="true" />
              </span>
              <span className="mt-3 text-base font-semibold text-on-surface">{plan.title}</span>
              <span className="mt-1 flex-1 text-xs leading-5 text-on-surface-variant sm:text-sm">
                {plan.body}
              </span>
              <span className="mt-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-on-surface-variant">
                {plan.meta}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] text-on-surface-variant">
        Paid contact tiers live on Pricing. Free opens a live workspace until billing exists.
      </p>
    </div>
  );
}
