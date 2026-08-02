import {
  CircleDollarSign,
  Clock3,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import type { ExpectationsAnswers, HumanInTheLoopPref } from '@shared/types';
import { OptionCards } from './OptionCards';
import { SpeedMeter } from './SpeedMeter';

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
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6" data-testid="expectations-slide">
      <section>
        <SpeedMeter
          value={value.speedMultiplier}
          onChange={(speedMultiplier) => onChange({ speedMultiplier })}
        />
      </section>

      <section>
        <OptionCards
          mode="multi"
          testId="ent-improve"
          label="What should improve first?"
          info="Select the metrics you want early wins on. We bias dashboards, suggestions, and policy defaults toward these outcomes first."
          hint="Required · select all that apply"
          columns={2}
          selected={value.improveAreas}
          onToggle={(id) => onChange({ improveAreas: toggleInList(value.improveAreas, id) })}
          options={[...IMPROVE]}
        />
      </section>

      <section>
        <OptionCards
          testId="ent-hitl"
          label="When should a human review?"
          info="Pick the default approval gate for AI-generated changes. You can tighten or loosen per project later—this is the org starting posture."
          hint="Required · this becomes your default approval posture"
          columns={2}
          selected={value.humanInTheLoop}
          onSelect={(id) => onChange({ humanInTheLoop: id as HumanInTheLoopPref })}
          options={[...HITL]}
        />
      </section>
    </div>
  );
}
