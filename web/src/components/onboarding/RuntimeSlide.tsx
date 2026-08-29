import type { ReactNode } from 'react';
import {
  Cloud,
  CloudCog,
  Link2,
  Radar,
  Server,
  Shield,
  Wallet,
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
import { QuestionLabel } from './QuestionInfo';
import { providerDisplay } from '../../lib/format';
import { getService } from '../../lib/serviceCatalog';
import { cn } from '../../lib/utils';

const PROVIDER_LOGO: Partial<Record<CloudProvider, string>> = {
  aws: getService('aws')?.logo ?? '/brands/aws.svg',
  azure: getService('azure')?.logo ?? '/brands/azure.svg',
  gcp: getService('gcp')?.logo ?? '/brands/gcp.svg',
  nvidia: getService('nvidia')?.logo ?? '/brands/nvidia.svg',
};

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

const HOSTING = [
  {
    id: 'customer_cloud' as const,
    title: 'Connected cloud accounts',
    description:
      'Run in AWS, Azure, GCP, or NVIDIA accounts from your stack. Billing and IAM stay on your side.',
    icon: Link2,
  },
  {
    id: 'public_managed' as const,
    title: '100x private cloud',
    description:
      'Fastest start. Jobs run on our managed private cloud — no customer cloud account required yet.',
    icon: Cloud,
  },
  {
    id: 'private_vpc' as const,
    title: 'Your cloud (BYOC)',
    description:
      'Bring your own cloud. Pick the platform now; connect that account on the next step.',
    icon: CloudCog,
  },
] as const;

const RUNTIME_MODE = [
  {
    id: 'request_based',
    title: 'On demand',
    description: 'Start workers when work arrives. Lower idle cost.',
    icon: Radar,
  },
  {
    id: 'always_on',
    title: 'Always on',
    description: 'Keep warm workers ready for lower latency.',
    icon: Server,
  },
] as const;

const MODELS = [
  {
    id: 'none',
    title: 'Managed models',
    description: 'Use 100x defaults. Simplest path.',
  },
  {
    id: 'side_by_side',
    title: 'Side-by-side',
    description: 'Compare your models next to managed ones.',
  },
  {
    id: 'trained',
    title: 'Train custom',
    description: 'Plan to fine-tune for your domain later.',
  },
] as const;

const CODE = [
  {
    id: 'forbidden',
    title: 'No code changes',
    description: 'AI can suggest only — never write to repos.',
  },
  {
    id: 'allowed_with_audit',
    title: 'With audit',
    description: 'AI may change code when every edit is logged.',
  },
  {
    id: 'allowed',
    title: 'Allowed',
    description: 'Trusted repos can accept AI edits more freely.',
  },
] as const;

const BUDGET = [
  { id: 'conservative', title: 'Conservative', description: 'Tight caps. Predictable spend.' },
  { id: 'balanced', title: 'Balanced', description: 'Room to try richer prompts.' },
  { id: 'aggressive', title: 'Aggressive', description: 'Prioritize speed over cost.' },
] as const;

const MCP = [
  { id: 'strict', title: 'Strict', description: 'Allowlist only. Least privilege.' },
  { id: 'balanced', title: 'Balanced', description: 'Common tools on by default.' },
  { id: 'open', title: 'Open', description: 'Broad access while you learn.' },
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

function Group({
  step,
  title,
  children,
}: {
  step: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-outline-variant/60 bg-surface/60 p-4 sm:p-5">
      <p className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
        <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-on-primary">
          {step}
        </span>
        {title}
      </p>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

export function RuntimeSlide({ value, onChange, selectedServices = [] }: RuntimeSlideProps) {
  const patch = (partial: Partial<RuntimeAnswers>) => onChange({ ...value, ...partial });
  const regions = value.regions ?? [];
  const linked = connectedProviders(selectedServices);
  const hosting = value.hosting;
  const showConnectedPicker = hosting === 'customer_cloud';
  const showByocPicker = hosting === 'private_vpc';
  const showPlatformPicker = showConnectedPicker || showByocPicker;
  const hostingChosen = Boolean(hosting);
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
    patch({
      hosting: next,
      cloudProvider: value.cloudProvider && value.cloudProvider !== 'private' ? value.cloudProvider : 'aws',
      customCloudLabel: value.cloudProvider === 'custom' ? value.customCloudLabel : undefined,
    });
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4" data-testid="runtime-slide">
      <p className="text-xs leading-5 text-on-surface-variant">
        Work top to bottom. Every group is required. Tap the{' '}
        <span className="font-semibold text-primary">?</span> next to a question if you are unsure
        what to pick — nothing is pre-selected.
      </p>

      <Group step={1} title="Where AI runs">
        <OptionCards
          testId="runtime-hosting"
          label="Choose a hosting home"
          info="This is the main decision. Connected accounts = your cloud bill and IAM. 100x private cloud = we host. BYOC = you bring a platform and connect it next. Pick one to unlock the rest of this step."
          hint="Required · pick exactly one"
          columns={1}
          density="comfortable"
          selected={value.hosting}
          onSelect={(id) => selectHosting(id as HostingPreference)}
          options={[...HOSTING]}
        />

        {showConnectedPicker && (
          <p className="text-xs leading-5 text-on-surface-variant" data-testid="runtime-connected-hint">
            {linked.length > 0
              ? `From your stack we can use: ${linked.map((p) => providerDisplay(p)).join(', ')}. We will not create a separate 100x account there.`
              : 'No AWS, Azure, GCP, or NVIDIA was selected in your stack yet. Pick a platform below (you can connect it next), or switch hosting to 100x private cloud / BYOC.'}
          </p>
        )}

        {hosting === 'public_managed' && (
          <p className="text-xs leading-5 text-on-surface-variant" data-testid="runtime-managed-hint">
            Jobs run on 100x’s managed private cloud. You can move to connected accounts or BYOC
            later under Governance → Cloud runtime.
          </p>
        )}

        {showByocPicker && (
          <p className="text-xs leading-5 text-on-surface-variant" data-testid="runtime-byoc-hint">
            Next you will connect the platform you pick so AI runs under your billing and IAM.
          </p>
        )}

        {showPlatformPicker && (
          <fieldset data-testid="runtime-cloud-provider">
            <legend className="text-sm font-semibold text-on-surface">
              <QuestionLabel
                label={showConnectedPicker ? 'Which cloud account?' : 'Which cloud platform?'}
                info={
                  showConnectedPicker
                    ? 'Pick the cloud brand AI should execute against. We use that account’s IAM and billing.'
                    : 'Pick the platform you own for BYOC. You will link the account on Connections.'
                }
              />
            </legend>
            <p className="mt-0.5 text-[11px] text-on-surface-variant">Required · pick one</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {platformOptions.map((provider) => {
                const isOn = value.cloudProvider === provider;
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
                      'inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-xs font-semibold transition',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                      isOn
                        ? 'border-primary bg-primary text-on-primary'
                        : 'border-outline-variant/70 bg-surface text-on-surface hover:border-primary/40',
                    )}
                  >
                    {PROVIDER_LOGO[provider] ? (
                      <img
                        src={PROVIDER_LOGO[provider]}
                        alt=""
                        className="size-5 rounded-sm bg-white object-contain p-0.5"
                      />
                    ) : null}
                    {providerDisplay(provider)}
                  </button>
                );
              })}
            </div>
            {value.cloudProvider === 'custom' && showByocPicker && (
              <label className="mt-3 block text-xs font-medium text-on-surface">
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
      </Group>

      {!hostingChosen ? (
        <p
          className="rounded-xl border border-dashed border-outline-variant bg-surface-container-low/50 px-4 py-6 text-center text-sm text-on-surface-variant"
          data-testid="runtime-unlock-hint"
        >
          Select a hosting home above to unlock runtime mode, models, and guardrails.
        </p>
      ) : (
        <>
          <Group step={2} title="How AI should run">
            <OptionCards
              testId="runtime-mode"
              label="Runtime mode"
              info="On demand spins up when work arrives (cheaper idle). Always on keeps workers warm for faster response. Most teams start with On demand."
              hint="Required · pick one"
              columns={2}
              selected={value.runtimeMode}
              onSelect={(id) => patch({ runtimeMode: id as RuntimeModePref })}
              options={[...RUNTIME_MODE]}
            />
            <OptionCards
              testId="runtime-custom-model"
              label="Model stance"
              info="Managed models = we pick defaults. Side-by-side = try your endpoints too. Train custom = you plan fine-tuning later. Start with Managed unless you already have a model program."
              hint="Required · pick one"
              columns={1}
              selected={value.customModel}
              onSelect={(id) => patch({ customModel: id as CustomModelPref })}
              options={[...MODELS]}
            />
          </Group>

          <Group step={3} title="Guardrails">
            <OptionCards
              testId="runtime-code-override"
              label="Can AI change code?"
              info="No code changes = suggestions only. With audit = edits allowed when logged. Allowed = freer writes on trusted repos. If you are unsure, pick With audit."
              hint="Required · pick one"
              columns={1}
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
              info="How hard AI may push token spend early on. Conservative is safest for pilots; Balanced is the usual default; Aggressive favors speed."
              hint="Required · pick one"
              columns={3}
              selected={value.tokenBudgetAppetite}
              onSelect={(id) => patch({ tokenBudgetAppetite: id as TokenBudgetAppetite })}
              options={[...BUDGET]}
            />
            <OptionCards
              testId="runtime-mcp-allowlist"
              label="Tool / MCP access"
              info="How open connectors are at first. Strict = allowlist only. Balanced = common tools. Open = broad access while exploring. Prefer Strict or Balanced for production-minded pilots."
              hint="Required · pick one"
              columns={3}
              selected={value.mcpAllowlistAggressiveness}
              onSelect={(id) =>
                patch({ mcpAllowlistAggressiveness: id as McpAllowlistAggressiveness })
              }
              options={[...MCP]}
            />

            <fieldset data-testid="runtime-regions">
              <legend className="text-sm font-semibold text-on-surface">
                <QuestionLabel
                  label="Preferred regions"
                  info="Where inference should land first for latency and data residency. Select every region you may use in phase one — you can refine later in Cloud settings."
                />
              </legend>
              <p className="mt-0.5 text-[11px] text-on-surface-variant">
                Required · select at least one
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
                        'inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition',
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
                <span className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-dashed border-outline-variant px-3 text-[11px] text-on-surface-variant">
                  <Wallet size={12} aria-hidden="true" />
                  More regions in Cloud settings
                </span>
              </div>
            </fieldset>
          </Group>
        </>
      )}
    </div>
  );
}
