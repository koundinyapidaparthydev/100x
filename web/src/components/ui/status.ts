export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export type StatusDefinition = {
  label: string;
  tone: StatusTone;
};

export const STATUS_REGISTRY: Record<string, StatusDefinition> = {
  pending: { label: 'Pending', tone: 'neutral' },
  queued: { label: 'Queued', tone: 'neutral' },
  running: { label: 'In progress', tone: 'info' },
  completed: { label: 'Ready for review', tone: 'success' },
  completed_pending_review: { label: 'Needs review', tone: 'warning' },
  approved: { label: 'Approved', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
  failed: { label: 'Failed', tone: 'danger' },
  blocked: { label: 'Blocked', tone: 'danger' },
  blocked_pii: { label: 'Sensitive data blocked', tone: 'danger' },
  ready_for_human: { label: 'Ready for review', tone: 'success' },
  none: { label: 'Not started', tone: 'neutral' },
  ai: { label: 'Sent to AI', tone: 'info' },
  human: { label: 'Assigned to person', tone: 'neutral' },
  redact: { label: 'Redacted', tone: 'success' },
  hash: { label: 'Hashed', tone: 'info' },
  allow: { label: 'Allowed', tone: 'warning' },
  available: { label: 'Ready to connect', tone: 'success' },
  planned: { label: 'Planned', tone: 'neutral' },
  needs_secure_setup: { label: 'Needs secure setup', tone: 'warning' },
};

export function getStatusDefinition(status: string): StatusDefinition {
  return (
    STATUS_REGISTRY[status] ?? {
      label: status.replaceAll('_', ' ').replace(/^\w/, (character) => character.toUpperCase()),
      tone: 'neutral',
    }
  );
}
