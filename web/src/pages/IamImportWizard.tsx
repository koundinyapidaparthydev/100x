import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@shared/api';
import { hasPlatformCapability } from '../lib/rbac';
import type { IamImportJob, IamImportSource } from '@shared/types';
import { useAsync } from '../lib/useAsync';
import {
  AsyncBoundary,
  Button,
  Card,
  Field,
  PageContainer,
  PageHeader,
  StatusBadge,
} from '../components/ui';
import { humanize } from '../lib/format';

const SOURCES: { id: IamImportSource; label: string; hint: string }[] = [
  { id: 'aws_iam', label: 'AWS IAM', hint: 'Paste exported IAM users/groups JSON' },
  { id: 'gcp_iam', label: 'GCP IAM', hint: 'Paste Cloud Identity / IAM export JSON' },
  { id: 'json', label: 'JSON file contents', hint: 'Generic { users, groups } JSON' },
  { id: 'csv', label: 'CSV', hint: 'email,role,groups columns' },
];

export default function IamImportWizard() {
  const me = useAsync(() => api.me(), []);
  const canManage = hasPlatformCapability(me.data?.user, 'identity.manage');
  const [step, setStep] = useState(0);
  const [source, setSource] = useState<IamImportSource>('aws_iam');
  const [payload, setPayload] = useState('');
  const [connectedAccount, setConnectedAccount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<IamImportJob | null>(null);
  const [jobs, setJobs] = useState<IamImportJob[]>([]);

  const loadJobs = async () => {
    if (!canManage) return;
    try {
      const res = await api.listIamImports();
      setJobs(res.jobs);
    } catch {
      setJobs([]);
    }
  };

  useEffect(() => {
    void loadJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canManage) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.createIamImport({
        source,
        payload: payload.trim() || undefined,
        connectedCloudAccount: connectedAccount.trim() || undefined,
      });
      setJob(res.job);
      setStep(2);
      await loadJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageContainer width="form">
      <PageHeader
        eyebrow="Identity"
        title="Import IAM"
        description="Phase 1 stub — preview-map AWS/GCP exports into 100x users and groups. Live API pull ships later."
        actions={
          <Link to="/console/users" className="text-sm font-medium text-primary hover:underline">
            Back to Users
          </Link>
        }
      />

      <AsyncBoundary loading={me.loading} error={me.error} onRetry={me.reload}>
        {!canManage ? (
          <Card>
            <p className="text-sm text-on-surface-variant">Requires capability: identity.manage (or workspace owner).</p>
          </Card>
        ) : (
          <div className="space-y-6" data-testid="iam-import-wizard">
            <div className="flex gap-2 text-xs font-semibold uppercase tracking-[0.06em] text-on-surface-variant">
              {['Source', 'Payload', 'Preview'].map((label, i) => (
                <span
                  key={label}
                  className={
                    i === step ? 'text-primary' : i < step ? 'text-on-surface' : 'text-on-surface-variant/60'
                  }
                >
                  {i + 1}. {label}
                </span>
              ))}
            </div>

            {step === 0 && (
              <Card title="Choose source">
                <div className="grid gap-2 sm:grid-cols-2">
                  {SOURCES.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setSource(s.id);
                        setStep(1);
                      }}
                      className={`rounded-lg border p-3 text-left transition-colors ${
                        source === s.id
                          ? 'border-primary bg-primary-container/40'
                          : 'border-outline-variant hover:bg-surface-container-low'
                      }`}
                      data-testid={`iam-import-source-${s.id}`}
                    >
                      <span className="block text-sm font-semibold">{s.label}</span>
                      <span className="mt-1 block text-xs text-on-surface-variant">{s.hint}</span>
                    </button>
                  ))}
                </div>
              </Card>
            )}

            {step === 1 && (
              <Card title={`Import from ${humanize(source)}`} description="Paste export or reference a connected cloud account.">
                <form onSubmit={onSubmit} className="space-y-4">
                  <Field label="Connected cloud account (optional)" hint="From onboarding / Connections — Phase 2 live pull">
                    <input
                      value={connectedAccount}
                      onChange={(e) => setConnectedAccount(e.target.value)}
                      placeholder="aws:123456789012 or gcp:my-project"
                      className="h-10 w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 text-sm"
                      data-testid="iam-import-cloud-account"
                    />
                  </Field>
                  <Field label="Exported JSON / CSV" hint="Stub parses counts only — no live cloud call">
                    <textarea
                      value={payload}
                      onChange={(e) => setPayload(e.target.value)}
                      rows={10}
                      placeholder='{"Users":[{"UserName":"alice"}],"Groups":[{"GroupName":"admins"}]}'
                      className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 font-mono text-xs outline-none focus:border-primary"
                      data-testid="iam-import-payload"
                    />
                  </Field>
                  {error && <p className="text-sm text-error">{error}</p>}
                  <div className="flex gap-2">
                    <Button type="button" variant="secondary" onClick={() => setStep(0)}>
                      Back
                    </Button>
                    <Button type="submit" loading={busy} data-testid="iam-import-submit">
                      Preview import
                    </Button>
                  </div>
                </form>
              </Card>
            )}

            {step === 2 && job && (
              <Card title="Import preview" description="Stub job recorded — no identities were mutated yet.">
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-2">
                    <StatusBadge status="info" label={humanize(job.status)} />
                    <span className="text-on-surface-variant">{job.id}</span>
                  </div>
                  <p>{job.summary}</p>
                  <p className="text-on-surface-variant">
                    Mapped preview: {job.mappedUsers} user(s), {job.mappedGroups} group(s)
                  </p>
                  <div className="flex gap-2 pt-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setStep(0);
                        setJob(null);
                        setPayload('');
                      }}
                    >
                      Run another
                    </Button>
                    <Link to="/console/users">
                      <Button type="button">Go to Users</Button>
                    </Link>
                  </div>
                </div>
              </Card>
            )}

            {jobs.length > 0 && (
              <Card title="Recent stub jobs" hierarchy="secondary">
                <ul className="space-y-2 text-sm">
                  {jobs.slice(0, 5).map((j) => (
                    <li key={j.id} className="flex items-center justify-between gap-2 border-b border-outline-variant/60 py-2 last:border-0">
                      <span>
                        {humanize(j.source)} · {j.mappedUsers}u / {j.mappedGroups}g
                      </span>
                      <StatusBadge status="neutral" label={humanize(j.status)} />
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        )}
      </AsyncBoundary>
    </PageContainer>
  );
}
