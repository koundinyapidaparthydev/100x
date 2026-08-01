import {
  Cloud,
  CloudCog,
  Lock,
  Radar,
  Server,
  Shield,
  Wallet,
  Workflow,
} from 'lucide-react';
import type {
  CustomModelPref,
  HostingPreference,
  McpAllowlistAggressiveness,
  RuntimeAnswers,
  RuntimeModePref,
  TokenBudgetAppetite,
} from '@shared/types';
import { OptionCards } from './OptionCards';
import { cn } from '../../lib/utils';

export type RuntimeSlideProps = {
  value: RuntimeAnswers;
  onChange: (next: RuntimeAnswers) => void;
};

const HOSTING = [
  {
    id: 'private_vpc',
    title: 'Private VPC',
    description: 'AI stays in your network. Strongest isolation.',
    icon: Lock,
  },
  {
    id: 'customer_cloud',
    title: 'Your cloud',
    description: 'Run in your AWS / Azure / GCP account.',
    icon: CloudCog,
  },
  {
    id: 'public_managed',
    title: 'Managed cloud',
    description: 'Fastest start on AplifyAI-hosted runtime.',
    icon: Cloud,
  },
] as const;

const RUNTIME_MODE = [
  {
    id: 'request_based',
    title: 'On demand',
    description: 'Spin up when work arrives.',
    icon: Radar,
  },
  {
    id: 'always_on',
    title: 'Always on',
    description: 'Warm workers for low latency.',
    icon: Server,
  },
] as const;

const MODELS = [
  {
    id: 'none',
    title: 'Managed models',
    description: 'Use platform defaults only.',
  },
  {
    id: 'side_by_side',
    title: 'Side-by-side',
    description: 'Compare custom models as you learn.',
  },
  {
    id: 'trained',
    title: 'Train custom',
    description: 'Fine-tune for your domain later.',
  },
] as const;

const CODE = [
  {
    id: 'forbidden',
    title: 'No code changes',
    description: 'AI can suggest, never write.',
  },
  {
    id: 'allowed_with_audit',
    title: 'With audit',
    description: 'Allowed when every change is logged.',
  },
  {
    id: 'allowed',
    title: 'Allowed',
    description: 'Trusted repos can accept AI edits.',
  },
] as const;

const BUDGET = [
  { id: 'conservative', title: 'Conservative', description: 'Cap spend tightly.' },
  { id: 'balanced', title: 'Balanced', description: 'Room to experiment.' },
  { id: 'aggressive', title: 'Aggressive', description: 'Prioritize speed.' },
] as const;

const MCP = [
  { id: 'strict', title: 'Strict', description: 'Allowlist only, least privilege.' },
  { id: 'balanced', title: 'Balanced', description: 'Common tools enabled.' },
  { id: 'open', title: 'Open', description: 'Broad access while learning.' },
] as const;

const REGION_PRESETS = [
  { id: 'eastus', label: 'US East' },
  { id: 'us-west-2', label: 'US West' },
  { id: 'westeurope', label: 'EU West' },
  { id: 'southeastasia', label: 'Asia' },
] as const;

export function RuntimeSlide({ value, onChange }: RuntimeSlideProps) {
  const patch = (partial: Partial<RuntimeAnswers>) => onChange({ ...value, ...partial });
  const regions = value.regions ?? [];

  const toggleRegion = (id: string) => {
    const next = regions.includes(id) ? regions.filter((r) => r !== id) : [...regions, id];
    patch({ regions: next });
  };

  return (
    <div className="space-y-3" data-testid="runtime-slide">
      <OptionCards
        testId="runtime-hosting"
        label="Where should AI run?"
        hint="This drives networking, security review, and connect setup."
        columns={3}
        selected={value.hosting}
        onSelect={(id) => patch({ hosting: id as HostingPreference })}
        options={[...HOSTING]}
      />

      <div className="grid gap-3 lg:grid-cols-2">
        <OptionCards
          testId="runtime-mode"
          label="Runtime mode"
          columns={2}
          selected={value.runtimeMode}
          onSelect={(id) => patch({ runtimeMode: id as RuntimeModePref })}
          options={[...RUNTIME_MODE]}
        />
        <OptionCards
          testId="runtime-custom-model"
          label="Model stance"
          columns={3}
          selected={value.customModel}
          onSelect={(id) => patch({ customModel: id as CustomModelPref })}
          options={[...MODELS]}
        />
        <OptionCards
          testId="runtime-code-override"
          label="Can AI change code?"
          columns={3}
          selected={value.codeOverrideStance}
          onSelect={(id) =>
            patch({
              codeOverrideStance: id as NonNullable<RuntimeAnswers['codeOverrideStance']>,
            })
          }
          options={[...CODE]}
        />
        <OptionCards
          testId="runtime-token-budget"
          label="Spend posture"
          columns={3}
          selected={value.tokenBudgetAppetite}
          onSelect={(id) => patch({ tokenBudgetAppetite: id as TokenBudgetAppetite })}
          options={[...BUDGET]}
        />
        <OptionCards
          testId="runtime-mcp-allowlist"
          label="Tool / MCP access"
          hint="How open should connectors be at first?"
          columns={3}
          selected={value.mcpAllowlistAggressiveness}
          onSelect={(id) =>
            patch({ mcpAllowlistAggressiveness: id as McpAllowlistAggressiveness })
          }
          options={[...MCP]}
        />

        <fieldset data-testid="runtime-regions">
          <legend className="flex items-center gap-2 text-sm font-semibold text-on-surface">
            <Workflow size={14} className="text-primary" aria-hidden="true" />
            Preferred regions
          </legend>
          <p className="mt-0.5 text-[11px] text-on-surface-variant">
            Multi-select where inference should land first.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {REGION_PRESETS.map((region) => {
              const isOn = regions.includes(region.id);
              return (
                <button
                  key={region.id}
                  type="button"
                  aria-pressed={isOn}
                  onClick={() => toggleRegion(region.id)}
                  className={cn(
                    'inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    isOn
                      ? 'border-primary bg-primary text-on-primary'
                      : 'border-outline-variant/70 bg-surface text-on-surface hover:border-primary/40',
                  )}
                >
                  <Shield size={12} aria-hidden="true" />
                  {region.label}
                </button>
              );
            })}
            <span className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-dashed border-outline-variant px-3 text-[11px] text-on-surface-variant">
              <Wallet size={12} aria-hidden="true" />
              More regions in Cloud settings
            </span>
          </div>
        </fieldset>
      </div>
    </div>
  );
}
