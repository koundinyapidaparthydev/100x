import { Lock } from 'lucide-react';
import { api } from '@shared/api';
import { useAsync } from '../lib/useAsync';
import { providerDisplay } from '../lib/format';

/**
 * Live trust line: model + cloud from the active policy, with a graceful
 * fallback when the API is unreachable.
 */
export function useSecurityStatusText(): string {
  const { data } = useAsync(() => api.listPolicies(), []);
  const policy = data?.[0];
  if (!policy) return 'Encryption Active | PII Redaction: Enabled';
  return `Encryption Active | Model: ${policy.model.modelId} | Cloud: ${providerDisplay(policy.cloud.provider)} ${policy.cloud.region} | PII Redaction: Enabled`;
}

export default function SecurityStatusLine() {
  const text = useSecurityStatusText();
  return (
    <div className="flex items-center gap-sm min-w-0">
      <Lock size={14} className="text-tertiary animate-pulse shrink-0" fill="currentColor" />
      <span className="font-label-sm text-label-sm text-tertiary uppercase tracking-wider truncate">{text}</span>
    </div>
  );
}
