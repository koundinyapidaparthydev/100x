import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Building2,
  ClipboardList,
  Gauge,
  Link2,
  Search,
  Shield,
  ShieldCheck,
  Users,
  Workflow,
} from 'lucide-react';
import { api } from '@shared/api';
import type {
  BuyerRole,
  DeliveryUrgency,
  EnterpriseMoveAnswers,
  ExpectationsAnswers,
  LiteOnboardingAnswers,
  OnboardingPlan,
  OnboardingProfile,
  RuntimeAnswers,
  ServiceCategory,
  ServiceId,
  TeamSizeBand,
  WorkspaceIntent,
} from '@shared/types';
import {
  ExpectationsSlide,
  OptionCards,
  PlanPicker,
  QuestionLabel,
  RuntimeSlide,
  ServicePicker,
  SlideShell,
} from '../components/onboarding';
import { AplifyLogo } from '../components/AplifyLogo';
import { Chip, Field } from '../components/ui';
import { FREE_CATALOG_CATEGORIES, getService } from '../lib/serviceCatalog';
import {
  emptyOnboardingProfile,
  hasSelectedServices,
  hydrateOnboardingFromServer,
  isEnterpriseMoveComplete,
  isExpectationsComplete,
  isLiteAnswersComplete,
  isRuntimeComplete,
  markOnboardingComplete,
  readOnboardingProfile,
  writeOnboardingProfile,
} from '../lib/onboardingStorage';
import { readDemoSession } from '../lib/session';
import { cn } from '../lib/utils';

const FREE_INTENTS = [
  {
    id: 'triage',
    title: 'Triage work faster',
    description: 'Pull tickets into one queue and decide what matters today.',
    icon: ClipboardList,
  },
  {
    id: 'connect_tools',
    title: 'Connect the stack',
    description: 'Wire boards, chat, and code so context follows the work.',
    icon: Link2,
  },
  {
    id: 'govern_ai',
    title: 'Govern AI safely',
    description: 'Keep PII, approvals, and audit in the loop from day one.',
    icon: ShieldCheck,
  },
  {
    id: 'explore',
    title: 'Explore the product',
    description: 'Tour the workspace first — configure deeply later.',
    icon: Search,
  },
] as const;

const TEAM_SIZE_OPTIONS = [
  { id: '1-5', title: '1–5 people', description: 'A focused squad shipping together.' },
  { id: '6-20', title: '6–20 people', description: 'A delivery pod or small program.' },
  { id: '21-100', title: '21–100 people', description: 'Multiple teams, shared tooling.' },
  { id: '100+', title: '100+ people', description: 'Org-wide delivery and governance.' },
] as const;

const PAIN_OPTIONS = [
  {
    id: 'Triage backlog',
    title: 'Backlog is drowning us',
    description: 'Too many tickets, unclear priority, slow intake.',
  },
  {
    id: 'PII / compliance risk',
    title: 'PII & compliance risk',
    description: 'Sensitive data leaks into AI prompts or chat.',
  },
  {
    id: 'Slow cycle time',
    title: 'Cycle time is too slow',
    description: 'Handoffs and tool switching stretch every change.',
  },
  {
    id: 'No audit trail',
    title: 'No reliable audit trail',
    description: 'Hard to show who approved what AI did.',
  },
  {
    id: 'Tool sprawl',
    title: 'Tool sprawl',
    description: 'Boards, chat, and code don’t share one story.',
  },
] as const;

const URGENCY_OPTIONS = [
  { id: 'this_week', title: 'This week', description: 'Need a working path immediately.' },
  { id: 'this_month', title: 'This month', description: 'Pilot with a real team soon.' },
  { id: 'this_quarter', title: 'This quarter', description: 'Planning a controlled rollout.' },
  { id: 'exploring', title: 'Just exploring', description: 'Learning fit before committing.' },
] as const;

const ENT_OUTCOMES = [
  {
    id: 'Centralize triage',
    title: 'One triage surface',
    description: 'Managers see work across boards without tab chaos.',
    icon: ClipboardList,
  },
  {
    id: 'Ship AI-assisted delivery',
    title: 'AI-assisted delivery',
    description: 'Drafts and suggestions that still need human approval.',
    icon: Workflow,
  },
  {
    id: 'Reduce PII exposure',
    title: 'Lower PII exposure',
    description: 'Redact and policy-gate before models see content.',
    icon: Shield,
  },
  {
    id: 'Audit every AI action',
    title: 'Audit every AI action',
    description: 'Evidence for who ran what, and what changed.',
    icon: ShieldCheck,
  },
  {
    id: 'Cut tool switching',
    title: 'Cut tool switching',
    description: 'Conversation, work, and code stay in one control plane.',
    icon: Link2,
  },
] as const;

const BUYER_ROLES = [
  {
    id: 'executive',
    title: 'Executive sponsor',
    description: 'Owns outcomes and budget.',
    icon: Building2,
  },
  {
    id: 'delivery_lead',
    title: 'Delivery lead',
    description: 'Runs triage, staffing, and approvals.',
    icon: Users,
  },
  {
    id: 'platform',
    title: 'Platform / Eng',
    description: 'Owns integrations, runtime, and MCP.',
    icon: Workflow,
  },
  {
    id: 'security',
    title: 'Security / GRC',
    description: 'Owns PII, SSO, and audit posture.',
    icon: Shield,
  },
  {
    id: 'ops',
    title: 'Ops / PMO',
    description: 'Owns process, reporting, and rollout.',
    icon: Gauge,
  },
] as const;

const COMPLIANCE = ['SOC2', 'HIPAA', 'GDPR', 'FedRAMP', 'Internal only'];

function toggleInList(list: string[] | undefined, value: string): string[] {
  const current = list ?? [];
  return current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
}

function MultiChoiceRow({
  label,
  info,
  hint,
  options,
  selected,
  onToggle,
  testId,
}: {
  label: string;
  info?: string;
  hint?: string;
  options: string[];
  selected?: string[];
  onToggle: (value: string) => void;
  testId: string;
}) {
  return (
    <fieldset data-testid={testId}>
      <legend className="text-sm font-semibold text-on-surface">
        <QuestionLabel label={label} info={info} />
      </legend>
      {hint ? <p className="mt-0.5 text-[11px] leading-4 text-on-surface-variant">{hint}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((opt) => (
          <Chip
            key={opt}
            tone="primary"
            selected={(selected ?? []).includes(opt)}
            onClick={() => onToggle(opt)}
          >
            {opt}
          </Chip>
        ))}
      </div>
    </fieldset>
  );
}

export default function Onboarding() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editing = searchParams.get('edit') === '1';
  const session = readDemoSession();
  const [plan, setPlan] = useState<OnboardingPlan | null>(null);
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<OnboardingProfile>(() => {
    const existing = readOnboardingProfile();
    return existing ?? emptyOnboardingProfile('free');
  });
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [gateReady, setGateReady] = useState(false);
  // Only bounce away after server hydrate — never trust a stale local completedAt alone.
  const [alreadyComplete, setAlreadyComplete] = useState(false);
  const [envKeys, setEnvKeys] = useState<string[]>(['prod', 'stage', 'dev']);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const done = await hydrateOnboardingFromServer();
      if (cancelled) return;
      const next = readOnboardingProfile() ?? emptyOnboardingProfile('free');
      setProfile(next);
      if (next.plan === 'free' || next.plan === 'enterprise') {
        setPlan(next.completedAt ? next.plan : null);
      }
      setAlreadyComplete(done);
      setGateReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!session) {
    return <Navigate to="/signup" replace />;
  }

  if (!gateReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-on-surface-variant">
        Checking workspace setup…
      </div>
    );
  }

  if (alreadyComplete && !editing) {
    return <Navigate to="/console" replace />;
  }

  const totalSteps = plan === 'enterprise' ? 4 : 2;

  const patchLite = (partial: LiteOnboardingAnswers) => {
    setProfile((prev) => ({
      ...prev,
      lite: { ...prev.lite, ...partial },
      updatedAt: new Date().toISOString(),
    }));
  };

  const patchMove = (partial: EnterpriseMoveAnswers) => {
    setProfile((prev) => ({
      ...prev,
      enterprise: {
        ...prev.enterprise,
        move: { ...prev.enterprise?.move, ...partial },
      },
      updatedAt: new Date().toISOString(),
    }));
  };

  const patchExpectations = (partial: ExpectationsAnswers) => {
    setProfile((prev) => ({
      ...prev,
      enterprise: {
        ...prev.enterprise,
        expectations: { ...prev.enterprise?.expectations, ...partial },
      },
      updatedAt: new Date().toISOString(),
    }));
  };

  const patchRuntime = (runtime: RuntimeAnswers) => {
    setProfile((prev) => ({
      ...prev,
      enterprise: { ...prev.enterprise, runtime },
      updatedAt: new Date().toISOString(),
    }));
  };

  const toggleService = (id: ServiceId) => {
    setProfile((prev) => {
      const selected = prev.selectedServices.includes(id)
        ? prev.selectedServices.filter((s) => s !== id)
        : [...prev.selectedServices, id];
      return { ...prev, selectedServices: selected, updatedAt: new Date().toISOString() };
    });
  };

  const setOther = (category: ServiceCategory, value: string) => {
    setProfile((prev) => ({
      ...prev,
      otherByCategory: { ...prev.otherByCategory, [category]: value },
      updatedAt: new Date().toISOString(),
    }));
  };

  const choosePlan = (next: OnboardingPlan) => {
    setPlan(next);
    setStep(1);
    setProfile(emptyOnboardingProfile(next));
  };

  const finish = async () => {
    if (envKeys.length === 0) {
      setSaveError('Select at least one environment to create.');
      return;
    }
    setBusy(true);
    setSaveError(null);
    const boardIds = profile.selectedServices.filter((id) => getService(id)?.category === 'boards');
    const withBoards =
      profile.plan === 'free'
        ? { ...profile, lite: { ...profile.lite, primaryBoards: boardIds } }
        : profile;
    const completed = markOnboardingComplete(withBoards);
    writeOnboardingProfile(completed);
    try {
      await api.ensureEnvironments({ keys: envKeys });
      const { profile: saved } = await api.putOnboarding({ profile: completed });
      writeOnboardingProfile(saved);
      setBusy(false);
      // Stack selections land on Connections (Available / Upcoming) before Home/Console.
      navigate('/connections');
    } catch (e) {
      console.warn('onboarding persist failed', e);
      setSaveError(
        e instanceof Error
          ? e.message
          : 'Could not save onboarding. Check your connection and try again.',
      );
      setBusy(false);
    }
  };

  const onContinue = () => {
    if (!plan) return;
    if (step < totalSteps) {
      setStep((s) => s + 1);
      return;
    }
    void finish();
  };

  const onBack = () => {
    if (step <= 1) {
      setPlan(null);
      setStep(0);
      return;
    }
    setStep((s) => s - 1);
  };

  const continueDisabled =
    plan === 'free'
      ? step === 1
        ? !isLiteAnswersComplete(profile.lite)
        : !hasSelectedServices(profile) || envKeys.length === 0
      : plan === 'enterprise'
        ? step === 1
          ? !isEnterpriseMoveComplete(profile.enterprise?.move)
          : step === 2
            ? !hasSelectedServices(profile)
            : step === 3
              ? !isExpectationsComplete(profile.enterprise?.expectations)
              : !isRuntimeComplete(profile.enterprise?.runtime) || envKeys.length === 0
        : true;

  const toggleEnvKey = (key: string) => {
    setEnvKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const environmentConfirm = (
    <section className="rounded-xl border border-outline-variant bg-surface-container-low/60 p-4" data-testid="onboarding-environments">
      <h3 className="text-sm font-semibold text-on-surface">Environments to create</h3>
      <p className="mt-1 text-xs text-on-surface-variant">
        Production, Staging, and Development are recommended. Keep at least one — you can add more later under Environments.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {(
          [
            { key: 'prod', name: 'Production' },
            { key: 'stage', name: 'Staging' },
            { key: 'dev', name: 'Development' },
          ] as const
        ).map((env) => {
          const checked = envKeys.includes(env.key);
          return (
            <label
              key={env.key}
              className={cn(
                'inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
                checked
                  ? 'border-primary bg-primary-container/50 text-on-primary-container'
                  : 'border-outline-variant bg-surface text-on-surface-variant',
              )}
            >
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={checked}
                onChange={() => toggleEnvKey(env.key)}
                data-testid={`onboarding-env-${env.key}`}
              />
              {env.name}
            </label>
          );
        })}
      </div>
    </section>
  );

  return (
    <div
      className={cn(
        'flex h-dvh flex-col overflow-hidden bg-background',
        'bg-[radial-gradient(1200px_600px_at_10%_-10%,rgba(79,99,182,0.12),transparent),radial-gradient(900px_500px_at_90%_0%,rgba(121,90,122,0.10),transparent)]',
      )}
      data-testid="onboarding-page"
    >
      <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col px-4 py-3 sm:px-6 lg:px-8">
        <div className="mb-2 shrink-0">
          <AplifyLogo size={24} withWordmark wordmarkClassName="text-sm" />
        </div>
        {saveError ? (
          <p
            className="mb-2 shrink-0 rounded-lg border border-outline-variant bg-surface-container px-3 py-2 text-sm text-error"
            data-testid="onboarding-save-error"
            role="alert"
          >
            {saveError}
          </p>
        ) : null}

        {!plan && (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <PlanPicker onSelect={choosePlan} />
          </div>
        )}

        {plan === 'free' && step === 1 && (
          <SlideShell
            step={1}
            totalSteps={2}
            title="Tailor your workspace"
            description="Answer each required question so we open the right queue and defaults — then pick your stack."
            onBack={onBack}
            onContinue={onContinue}
            continueDisabled={continueDisabled}
          >
            <div className="mx-auto flex max-w-3xl flex-col gap-6">
              <section>
                <OptionCards
                  mode="multi"
                  testId="lite-intent"
                  label="What do you want to get done first?"
                  info="Select every job you want the workspace to emphasize early. Multiple picks are fine — we use them together for default queues, suggestions, and which integrations we surface first."
                  hint="Required · select all that apply"
                  columns={2}
                  selected={
                    profile.lite?.intents?.length
                      ? profile.lite.intents
                      : profile.lite?.intent
                        ? [profile.lite.intent]
                        : []
                  }
                  onToggle={(id) => {
                    const current =
                      profile.lite?.intents?.length
                        ? profile.lite.intents
                        : profile.lite?.intent
                          ? [profile.lite.intent]
                          : [];
                    const next = toggleInList(current, id) as WorkspaceIntent[];
                    patchLite({ intents: next, intent: next[0] });
                  }}
                  options={[...FREE_INTENTS]}
                />
              </section>
              <section>
                <OptionCards
                  testId="lite-team-size"
                  label="Delivery team size"
                  info="Choose the size of the group that will use AplifyAI day to day. We use this for default collaboration and approval patterns—not billing."
                  hint="Required · pick one"
                  columns={2}
                  selected={profile.lite?.teamSize}
                  onSelect={(id) => patchLite({ teamSize: id as TeamSizeBand })}
                  options={[...TEAM_SIZE_OPTIONS]}
                />
              </section>
              <section>
                <OptionCards
                  mode="multi"
                  testId="lite-pains"
                  label="What’s getting in the way?"
                  info="Select every friction that is real today. Multiple answers help us prioritize redaction, audit, triage, and integration defaults together."
                  hint="Required · select all that apply"
                  columns={2}
                  selected={profile.lite?.biggestPains}
                  onToggle={(id) =>
                    patchLite({ biggestPains: toggleInList(profile.lite?.biggestPains, id) })
                  }
                  options={[...PAIN_OPTIONS]}
                />
              </section>
            </div>
          </SlideShell>
        )}

        {plan === 'free' && step === 2 && (
          <SlideShell
            step={2}
            totalSteps={2}
            title="Your stack"
            description="Search and add boards, chat, and code tools. Selected items become Connections."
            onBack={onBack}
            onContinue={onContinue}
            continueLabel="Save & continue"
            continueDisabled={continueDisabled}
            busy={busy}
          >
            <div className="flex flex-col gap-6">
              <ServicePicker
                categories={FREE_CATALOG_CATEGORIES}
                selected={profile.selectedServices}
                otherByCategory={profile.otherByCategory}
                onToggle={toggleService}
                onOtherChange={setOther}
                showIdentityDisplayOnly={false}
              />
              {environmentConfirm}
            </div>
          </SlideShell>
        )}

        {plan === 'enterprise' && step === 1 && (
          <SlideShell
            step={1}
            totalSteps={4}
            title="Why you’re moving here"
            description="Required answers shape governance defaults and integration priority. Context is optional."
            onBack={onBack}
            onContinue={onContinue}
            continueDisabled={continueDisabled}
          >
            <div className="mx-auto flex max-w-3xl flex-col gap-6">
              <section>
                <OptionCards
                  mode="multi"
                  testId="ent-goals"
                  label="Which outcomes must this unlock?"
                  info="Select every outcome leadership will judge success by. These drive governance defaults, audit emphasis, and which integrations we prioritize first."
                  hint="Required · select all that apply"
                  columns={2}
                  selected={profile.enterprise?.move?.goals}
                  onToggle={(id) =>
                    patchMove({ goals: toggleInList(profile.enterprise?.move?.goals, id) })
                  }
                  options={[...ENT_OUTCOMES]}
                />
              </section>

              <section className="grid gap-6 sm:grid-cols-2">
                <OptionCards
                  testId="ent-buyer-role"
                  label="Who’s leading this evaluation?"
                  info="Pick the role that owns the decision and day-to-day setup. We tailor language, approval defaults, and security prompts for that buyer—not your entire org chart."
                  hint="Required · pick one"
                  columns={1}
                  selected={profile.enterprise?.move?.buyerRole || undefined}
                  onSelect={(id) => patchMove({ buyerRole: id as BuyerRole })}
                  options={[...BUYER_ROLES]}
                />
                <OptionCards
                  testId="ent-org-size"
                  label="Org size this will cover"
                  info="Choose how many people this rollout is meant to serve. Larger bands unlock stricter multi-team defaults; pick the scope you will cover in the first phase."
                  hint="Required · pick one"
                  columns={1}
                  selected={profile.enterprise?.move?.orgSize || undefined}
                  onSelect={(id) => patchMove({ orgSize: id as TeamSizeBand })}
                  options={[...TEAM_SIZE_OPTIONS]}
                />
              </section>

              <section>
                <MultiChoiceRow
                  testId="ent-compliance"
                  label="Compliance posture"
                  info="Select frameworks you must respect in production. Multiple tags are fine—each one tightens redaction, logging, and residency defaults. Use Internal only if you have no external attestation yet."
                  hint="Required · select all that apply"
                  options={COMPLIANCE}
                  selected={profile.enterprise?.move?.complianceNeeds}
                  onToggle={(v) =>
                    patchMove({
                      complianceNeeds: toggleInList(profile.enterprise?.move?.complianceNeeds, v),
                    })
                  }
                />
              </section>

              <section>
                <OptionCards
                  testId="ent-timeline"
                  label="Production-ready by when?"
                  info="Pick when a governed production path needs to be usable. This sets rollout pace and how aggressive we are with defaults—not a contractual SLA."
                  hint="Required · pick one"
                  columns={2}
                  selected={profile.enterprise?.move?.timeline || undefined}
                  onSelect={(id) => patchMove({ timeline: id as DeliveryUrgency })}
                  options={[...URGENCY_OPTIONS]}
                />
              </section>

              <section>
                <Field
                  label={
                    <QuestionLabel
                      label="Context (optional)"
                      info="Add anything that changes how we should configure you—existing copilots, VPC constraints, must-keep tools, or known blockers. Free text; skip if nothing unique."
                    />
                  }
                  placeholder="Copilot in use, private VPC, Jira + ServiceNow…"
                  value={profile.enterprise?.move?.currentAiUsage ?? ''}
                  onChange={(e) => patchMove({ currentAiUsage: e.target.value })}
                />
              </section>
            </div>
          </SlideShell>
        )}

        {plan === 'enterprise' && step === 2 && (
          <SlideShell
            step={2}
            totalSteps={4}
            title="Current services"
            description="Search each category and add at least one system you already run."
            onBack={onBack}
            onContinue={onContinue}
            continueDisabled={continueDisabled}
          >
            <ServicePicker
              selected={profile.selectedServices}
              otherByCategory={profile.otherByCategory}
              onToggle={toggleService}
              onOtherChange={setOther}
              showIdentityDisplayOnly
            />
          </SlideShell>
        )}

        {plan === 'enterprise' && step === 3 && (
          <SlideShell
            step={3}
            totalSteps={4}
            title="Set the bar"
            description="Speed, quality, and how much human review you want before AI actions stick."
            onBack={onBack}
            onContinue={onContinue}
            continueDisabled={continueDisabled}
          >
            <ExpectationsSlide
              value={profile.enterprise?.expectations ?? {}}
              onChange={patchExpectations}
            />
          </SlideShell>
        )}

        {plan === 'enterprise' && step === 4 && (
          <SlideShell
            step={4}
            totalSteps={4}
            title="Where AI runs"
            description="Pick hosting first, then runtime and guardrails. Use ? on each question if a choice is unclear — nothing is pre-filled."
            onBack={onBack}
            onContinue={onContinue}
            continueLabel="Save & continue"
            continueDisabled={continueDisabled}
            busy={busy}
          >
            <div className="flex flex-col gap-6">
              <RuntimeSlide
                value={profile.enterprise?.runtime ?? {}}
                onChange={patchRuntime}
                selectedServices={profile.selectedServices}
              />
              {environmentConfirm}
            </div>
          </SlideShell>
        )}

      </div>
    </div>
  );
}
