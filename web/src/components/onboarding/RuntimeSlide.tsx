import {
  Cloud,
  CloudCog,
  Link2,
  Radar,
  Server,
  Shield,
  Wallet,
  Workflow,
} from 'lucide-react';
import {
  PRIVATE_CLOUD_PROVIDERS,
  type CloudProvider,
  type CustomModelPref,
  type HostingPreference,
  type McpAllowlistAggressiveness,
  type RuntimeAnswers,
  type RuntimeModePref,
  type ServiceId,
  type TokenBudgetAppetite,
} from '@shared/types';
import { OptionCards } from './OptionCards';
import { providerDisplay } from '../../lib/format';
import { cn } from '../../lib/utils';

/** Catalog cloud services that map 1:1 onto CloudProvider. */
const CLOUD_SERVICE_PROVIDERS: { serviceId: ServiceId; provider: CloudProvider }[] = [
  { serviceId: 'aws', provider: 'aws' },
  { serviceId: 'azure', provider: 'azure' },
  { serviceId: 'gcp', provider: 'gcp' },
  { serviceId: 'nvidia', provider: 'nvidia' },
];

export type RuntimeSlideProps = {
  value: RuntimeAnswers;
  onChange: (next: RuntimeAnswers) => void;
  /** Services picked earlier in onboarding (used for “connected accounts”). */
  selectedServices?: ServiceId[];
};

/**
 * Three product choices for where AI runs:
 * 1. connected accounts already selected (AWS/Azure/GCP/NVIDIA) — we use their account
 * 2. AplifyAI private cloud — our managed private plane
 * 3. customer BYOC — they pick a platform and connect that account next
 */
const HOSTING = [
  {
    id: 'customer_cloud' as const,
    title: 'Connected cloud accounts',
    description:
      'Use AWS, Azure, GCP, or NVIDIA accounts from your stack — we run in your account, not one we create.',
    icon: Link2,
  },
  {
    id: 'public_managed' as const,
    title: 'AplifyAI private cloud',
    description:
      'Run on our managed private cloud. No customer AWS, Azure, GCP, or NVIDIA account required.',
    icon: Cloud,
  },
  {
    id: 'private_vpc' as const,
    title: 'Your cloud (BYOC)',
    description:
      'Bring your own cloud. Choose the platform now; connect that account on the next step.',
    icon: CloudCog,
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

function connectedProviders(selected: ServiceId[] | undefined): CloudProvider[] {
  if (!selected?.length) return [];
  const set = new Set(selected);
  return CLOUD_SERVICE_PROVIDERS.filter((c) => set.has(c.serviceId)).map((c) => c.provider);
}

export function RuntimeSlide({ value, onChange, selectedServices = [] }: RuntimeSlideProps) {
  const patch = (partial: Partial<RuntimeAnswers>) => onChange({ ...value, ...partial });
  const regions = value.regions ?? [];
  const linked = connectedProviders(selectedServices);
  const hosting = value.hosting;
  const showConnectedPicker = hosting === 'customer_cloud';
  const showByocPicker = hosting === 'private_vpc';
  const showPlatformPicker = showConnectedPicker || showByocPicker;
  const platformOptions: CloudProvider[] = showConnectedPicker
    ? linked.length > 0
      ? linked
      : CLOUD_SERVICE_PROVIDERS.map((c) => c.provider)
    : PRIVATE_CLOUD_PROVIDERS;

  const toggleRegion = (id: string) => {
    const next = regions.includes(id) ? regions.filter((r) => r !== id) : [...regions, id];
    patch({ regions: next });
  };

  const selectHosting = (next: HostingPreference) => {
    if (next === 'public_managed') {
      patch({
        hosting: next,
        cloudProvider: 'private',
        customCloudLabel: undefined,
      });
      return;
    }
    if (next === 'customer_cloud') {
      const preferred =
        (value.cloudProvider && linked.includes(value.cloudProvider) && value.cloudProvider) ||
        linked[0] ||
        'aws';
      patch({
        hosting: next,
        cloudProvider: preferred,
        customCloudLabel: undefined,
      });
      return;
    }
    // BYOC
    patch({
      hosting: next,
      cloudProvider: value.cloudProvider && value.cloudProvider !== 'private' ? value.cloudProvider : 'aws',
      customCloudLabel: value.cloudProvider === 'custom' ? value.customCloudLabel : undefined,
    });
  };

  return (
    <div className="space-y-3" data-testid="runtime-slide">
      <OptionCards
        testId="runtime-hosting"
        label="Where should AI run?"
        hint="Choose whether we use accounts you already linked, our private cloud, or a cloud you bring yourself."
        columns={3}
        selected={value.hosting}
        onSelect={(id) => selectHosting(id as HostingPreference)}
        options={[...HOSTING]}
      />

      {showConnectedPicker && (
        <p className="text-xs leading-5 text-on-surface-variant" data-testid="runtime-connected-hint">
          {linked.length > 0
            ? `Using cloud accounts from your stack: ${linked.map((p) => providerDisplay(p)).join(', ')}. We will not create a separate AplifyAI account in those clouds.`
            : 'No AWS, Azure, GCP, or NVIDIA service was selected in your stack yet. Pick one below — you can connect the account on the next step — or switch to AplifyAI private cloud / Your cloud (BYOC).'}
        </p>
      )}

      {hosting === 'public_managed' && (
        <p className="text-xs leading-5 text-on-surface-variant" data-testid="runtime-managed-hint">
          Jobs run on AplifyAI’s managed private cloud. You can switch to connected accounts or BYOC
          later under Governance → Cloud runtime.
        </p>
      )}

      {showByocPicker && (
        <p className="text-xs leading-5 text-on-surface-variant" data-testid="runtime-byoc-hint">
          Pick the platform you own. On Connections you will link that account so AI runs under your
          billing and IAM — not an account we create for you.
        </p>
      )}

      {showPlatformPicker && (
        <fieldset data-testid="runtime-cloud-provider">
          <legend className="text-sm font-semibold text-on-surface">
            {showConnectedPicker ? 'Which connected cloud?' : 'Which cloud platform?'}
          </legend>
          <p className="mt-0.5 text-[11px] text-on-surface-variant">
            {showConnectedPicker
              ? 'Select the account we should execute against.'
              : 'AWS, Azure, NVIDIA, GCP, a generic private cloud, or another platform you name.'}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {platformOptions.map((provider) => {
              const isOn = (value.cloudProvider ?? platformOptions[0]) === provider;
              return (
                <button
                  key={provider}
                  type="button"
                  aria-pressed={isOn}
                  onClick={() =>
                    patch({
                      cloudProvider: provider,
                      customCloudLabel: provider === 'custom' ? value.customCloudLabel : undefined,
                    })
                  }
                  className={cn(
                    'inline-flex min-h-9 items-center rounded-lg border px-3 text-xs font-semibold transition',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    isOn
                      ? 'border-primary bg-primary text-on-primary'
                      : 'border-outline-variant/70 bg-surface text-on-surface hover:border-primary/40',
                  )}
                >
                  {providerDisplay(provider)}
                </button>
              );
            })}
          </div>
          {(value.cloudProvider ?? 'aws') === 'custom' && showByocPicker && (
            <label className="mt-2 block text-xs font-medium text-on-surface">
              Platform name
              <input
                data-testid="runtime-custom-cloud-label"
                type="text"
                value={value.customCloudLabel ?? ''}
                onChange={(e) => patch({ customCloudLabel: e.target.value })}
                placeholder="e.g. Oracle Cloud, CoreWeave, on-prem K8s"
                className="mt-1.5 min-h-10 w-full rounded-lg border border-outline-variant bg-surface px-3 text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
            </label>
          )}
        </fieldset>
      )}

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
