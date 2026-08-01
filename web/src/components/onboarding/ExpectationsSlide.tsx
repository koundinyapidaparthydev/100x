import {
  CircleDollarSign,
  Clock3,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import type { ExpectationsAnswers, HumanInTheLoopPref } from '@shared/types';
import { OptionCards } from './OptionCards';
import { SpeedMeter } from './SpeedMeter';
import { cn } from '../../lib/utils';

export type ExpectationsSlideProps = {
  value: ExpectationsAnswers;
  onChange: (partial: ExpectationsAnswers) => void;
};

const IMPROVE = [
  {
    id: 'Cycle time',
    title: 'Cycle time',
    description: 'Ship changes faster end-to-end.',
    icon: Clock3,
  },
  {
    id: 'Quality',
    title: 'Quality',
    description: 'Fewer defects and rework.',
    icon: Sparkles,
  },
  {
    id: 'PII risk',
    title: 'PII risk',
    description: 'Keep sensitive data out of models.',
    icon: ShieldAlert,
  },
  {
    id: 'Cost visibility',
    title: 'Cost visibility',
    description: 'See spend before it spikes.',
    icon: CircleDollarSign,
  },
] as const;

const COMPLETION = [10, 20, 40, 60] as const;

const HITL = [
  {
    id: 'always',
    title: 'Always review',
    description: 'Every AI action needs a human OK.',
  },
  {
    id: 'high_risk',
    title: 'High-risk only',
    description: 'Auto-run safe work; review the rest.',
  },
  {
    id: 'exceptions',
    title: 'Exceptions',
    description: 'Review when policy or PII flags fire.',
  },
  {
    id: 'minimal',
    title: 'Minimal',
    description: 'Trust the rails; spot-check later.',
  },
] as const;

function toggleInList(list: string[] | undefined, value: string): string[] {
  const current = list ?? [];
  return current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
}

export function ExpectationsSlide({ value, onChange }: ExpectationsSlideProps) {
  const completion = value.aiCompletionTargetPercent ?? 20;

  return (
    <div className="grid gap-3 lg:grid-cols-2" data-testid="expectations-slide">
      <div className="lg:col-span-2">
        <SpeedMeter
          value={value.speedMultiplier ?? 20}
          onChange={(speedMultiplier) => onChange({ speedMultiplier })}
        />
      </div>

      <OptionCards
        mode="multi"
        testId="ent-improve"
        label="What should improve first?"
        hint="Pick the outcomes we’ll optimize for early."
        columns={2}
        selected={value.improveAreas}
        onToggle={(id) => onChange({ improveAreas: toggleInList(value.improveAreas, id) })}
        options={[...IMPROVE]}
      />

      <fieldset data-testid="ent-completion-target">
        <legend className="text-sm font-semibold text-on-surface">AI draft completion target</legend>
        <p className="mt-0.5 text-[11px] text-on-surface-variant">
          How much of a typical item should AI try to finish before handoff?
        </p>
        <div className="mt-2 grid grid-cols-4 gap-1.5">
          {COMPLETION.map((n) => {
            const isOn = completion === n;
            return (
              <button
                key={n}
                type="button"
                aria-pressed={isOn}
                onClick={() => onChange({ aiCompletionTargetPercent: n })}
                className={cn(
                  'min-h-12 rounded-lg border text-sm font-semibold transition',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  isOn
                    ? 'border-primary bg-primary text-on-primary'
                    : 'border-outline-variant/70 bg-surface text-on-surface hover:border-primary/50',
                )}
              >
                {n}%
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="lg:col-span-2">
        <OptionCards
          testId="ent-hitl"
          label="When should a human review?"
          hint="This becomes your default approval posture."
          columns={4}
          selected={value.humanInTheLoop}
          onSelect={(id) => onChange({ humanInTheLoop: id as HumanInTheLoopPref })}
          options={[...HITL]}
        />
      </div>
    </div>
  );
}
