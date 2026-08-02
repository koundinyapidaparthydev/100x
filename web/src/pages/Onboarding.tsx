import { useState } from 'react';
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
  RuntimeSlide,
  ServicePicker,
  SlideShell,
} from '../components/onboarding';
import { Chip, Field } from '../components/ui';
import { FREE_CATALOG_CATEGORIES, getService } from '../lib/serviceCatalog';
import {
  emptyOnboardingProfile,
  isOnboardingComplete,
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
  hint,
  options,
  selected,
  onToggle,
  testId,
}: {
  label: string;
  hint?: string;
  options: string[];
  selected?: string[];
  onToggle: (value: string) => void;
  testId: string;
}) {
  return (
    <fieldset data-testid={testId}>
      <legend className="text-sm font-semibold text-on-surface">{label}</legend>
      {hint ? <p className="mt-1 text-xs text-on-surface-variant">{hint}</p> : null}
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
  // Capture once so finishing the wizard (which writes completedAt) doesn't bounce to /projects
  // before the intentional navigate('/connections').
  const [alreadyComplete] = useState(() => isOnboardingComplete());

  if (!session) {
    return <Navigate to="/signup" replace />;
  }

  if (alreadyComplete && !editing) {
    return <Navigate to="/projects" replace />;
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
    setBusy(true);
    const boardIds = profile.selectedServices.filter((id) => getService(id)?.category === 'boards');
    const withBoards =
      profile.plan === 'free'
        ? { ...profile, lite: { ...profile.lite, primaryBoards: boardIds } }
        : profile;
    const completed = markOnboardingComplete(withBoards);
    writeOnboardingProfile(completed);
    try {
      await api.putOnboarding({ profile: completed });
    } catch (e) {
      // Local draft is enough for Connections; surface a soft warning if API fails.
      console.warn('onboarding persist failed', e);
    }
    setBusy(false);
    navigate('/connections');
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

  return (
    <div
      className={cn(
        'flex h-dvh flex-col overflow-hidden bg-background',
        'bg-[radial-gradient(1200px_600px_at_10%_-10%,rgba(79,99,182,0.12),transparent),radial-gradient(900px_500px_at_90%_0%,rgba(121,90,122,0.10),transparent)]',
      )}
      data-testid="onboarding-page"
    >
      <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col px-4 py-3 sm:px-6 lg:px-8">
        <p className="mb-2 shrink-0 text-sm font-semibold tracking-tight text-on-surface">AplifyAI</p>

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
            description="Quick answers so we open the right queue and defaults — then pick your stack."
            onBack={onBack}
            onContinue={onContinue}
          >
            <div className="grid gap-3 lg:grid-cols-2">
              <OptionCards
                testId="lite-intent"
                label="What do you want to get done first?"
                columns={2}
                selected={profile.lite?.intent}
                onSelect={(id) => patchLite({ intent: id as WorkspaceIntent })}
                options={[...FREE_INTENTS]}
              />
              <OptionCards
                testId="lite-team-size"
                label="Delivery team size"
                columns={2}
                selected={profile.lite?.teamSize}
                onSelect={(id) => patchLite({ teamSize: id as TeamSizeBand })}
                options={[...TEAM_SIZE_OPTIONS]}
              />
              <OptionCards
                mode="multi"
                testId="lite-pains"
                label="What’s getting in the way?"
                hint="Select all that apply"
                columns={2}
                selected={profile.lite?.biggestPains}
                onToggle={(id) =>
                  patchLite({ biggestPains: toggleInList(profile.lite?.biggestPains, id) })
                }
                options={[...PAIN_OPTIONS]}
              />
              <OptionCards
                testId="lite-urgency"
                label="When do you need this working?"
                columns={2}
                selected={profile.lite?.urgency}
                onSelect={(id) => patchLite({ urgency: id as DeliveryUrgency })}
                options={[...URGENCY_OPTIONS]}
              />
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
            busy={busy}
          >
            <ServicePicker
              categories={FREE_CATALOG_CATEGORIES}
              selected={profile.selectedServices}
              otherByCategory={profile.otherByCategory}
              onToggle={toggleService}
              onOtherChange={setOther}
              showIdentityDisplayOnly={false}
            />
          </SlideShell>
        )}

        {plan === 'enterprise' && step === 1 && (
          <SlideShell
            step={1}
            totalSteps={4}
            title="Why you’re moving here"
            description="Shapes governance defaults and integration priority."
            onBack={onBack}
            onContinue={onContinue}
          >
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="lg:col-span-2">
                <OptionCards
                  mode="multi"
                  testId="ent-goals"
                  label="Which outcomes must this unlock?"
                  hint="Select all that apply"
                  columns={3}
                  selected={profile.enterprise?.move?.goals}
                  onToggle={(id) =>
                    patchMove({ goals: toggleInList(profile.enterprise?.move?.goals, id) })
                  }
                  options={[...ENT_OUTCOMES]}
                />
              </div>
              <OptionCards
                testId="ent-buyer-role"
                label="Who’s leading this evaluation?"
                columns={2}
                selected={profile.enterprise?.move?.buyerRole || undefined}
                onSelect={(id) => patchMove({ buyerRole: id as BuyerRole })}
                options={[...BUYER_ROLES]}
              />
              <OptionCards
                testId="ent-org-size"
                label="Org size this will cover"
                columns={2}
                selected={profile.enterprise?.move?.orgSize || undefined}
                onSelect={(id) => patchMove({ orgSize: id as TeamSizeBand })}
                options={[...TEAM_SIZE_OPTIONS]}
              />
              <MultiChoiceRow
                testId="ent-compliance"
                label="Compliance posture"
                options={COMPLIANCE}
                selected={profile.enterprise?.move?.complianceNeeds}
                onToggle={(v) =>
                  patchMove({
                    complianceNeeds: toggleInList(profile.enterprise?.move?.complianceNeeds, v),
                  })
                }
              />
              <div className="space-y-3">
                <OptionCards
                  testId="ent-timeline"
                  label="Production-ready by when?"
                  columns={2}
                  selected={profile.enterprise?.move?.timeline || undefined}
                  onSelect={(id) => patchMove({ timeline: id as DeliveryUrgency })}
                  options={[...URGENCY_OPTIONS]}
                />
                <Field
                  label="Context (optional)"
                  placeholder="Copilot in use, private VPC, Jira + ServiceNow…"
                  value={profile.enterprise?.move?.currentAiUsage ?? ''}
                  onChange={(e) => patchMove({ currentAiUsage: e.target.value })}
                />
              </div>
            </div>
          </SlideShell>
        )}

        {plan === 'enterprise' && step === 2 && (
          <SlideShell
            step={2}
            totalSteps={4}
            title="Current services"
            description="Search each category and add the systems you already run."
            onBack={onBack}
            onContinue={onContinue}
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
            description="Use connected cloud accounts, AplifyAI private cloud, or bring your own — then models, code access, and tool posture."
            onBack={onBack}
            onContinue={onContinue}
            continueLabel="Save & continue"
            busy={busy}
          >
            <RuntimeSlide
              value={profile.enterprise?.runtime ?? {}}
              onChange={patchRuntime}
              selectedServices={profile.selectedServices}
            />
          </SlideShell>
        )}

      </div>
    </div>
  );
}
