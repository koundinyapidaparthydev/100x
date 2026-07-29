import type { AiJobState, AiStatus, ApprovalRisk, WorkItem } from '@shared/types';

export interface ChipStyle {
  label: string;
  className: string;
}

const NEUTRAL = 'bg-surface-container-high text-on-surface-variant';

/** Semantic chip styling for a WorkItem priority. */
export function priorityChip(priority: WorkItem['priority']): ChipStyle {
  switch (priority) {
    case 'critical':
      return { label: 'Critical', className: 'bg-error-container text-on-error-container' };
    case 'high':
      return { label: 'High', className: 'bg-warning-container text-on-warning-container' };
    case 'medium':
      return { label: 'Medium', className: 'bg-tertiary-container text-on-tertiary-container' };
    case 'low':
      return { label: 'Low', className: NEUTRAL };
  }
}

/** Semantic chip styling for a WorkItem AI status. */
export function aiStatusChip(status: AiStatus): ChipStyle {
  switch (status) {
    case 'none':
      return { label: 'No AI yet', className: NEUTRAL };
    case 'queued':
      return { label: 'AI queued', className: 'bg-secondary-container text-on-secondary-container' };
    case 'running':
      return { label: 'AI running', className: 'bg-tertiary-container text-on-tertiary-container' };
    case 'ready_for_human':
      return { label: 'Ready for human', className: 'bg-primary-container text-on-primary-container' };
    case 'blocked_pii':
      return { label: 'PII blocked', className: 'bg-warning-container text-on-warning-container' };
    case 'failed':
      return { label: 'AI failed', className: 'bg-error-container text-on-error-container' };
    case 'cancelled':
      return { label: 'Cancelled', className: 'bg-error-container text-on-error-container' };
  }
}

/** Semantic chip styling for an AiJob state (Jobs screen). */
export function jobStateChip(state: AiJobState): ChipStyle {
  switch (state) {
    case 'queued':
      return { label: 'Queued', className: 'bg-secondary-container text-on-secondary-container' };
    case 'sanitizing':
      return { label: 'Sanitizing', className: 'bg-tertiary-container text-on-tertiary-container' };
    case 'enriching_mcp':
      return { label: 'Enriching', className: 'bg-tertiary-container text-on-tertiary-container' };
    case 'running':
      return { label: 'Running', className: 'bg-tertiary-container text-on-tertiary-container' };
    case 'packaging':
      return { label: 'Packaging', className: 'bg-tertiary-container text-on-tertiary-container' };
    case 'attaching':
      return { label: 'Attaching', className: 'bg-tertiary-container text-on-tertiary-container' };
    case 'ready_for_human':
      return { label: 'Ready for human', className: 'bg-primary-container text-on-primary-container' };
    case 'blocked_pii':
      return { label: 'PII blocked', className: 'bg-warning-container text-on-warning-container' };
    case 'failed':
      return { label: 'Failed', className: 'bg-error-container text-on-error-container' };
    case 'cancelled':
      return { label: 'Cancelled', className: 'bg-error-container text-on-error-container' };
  }
}

/** Semantic chip styling for an approval risk level. */
export function riskChip(risk: ApprovalRisk): ChipStyle {
  switch (risk) {
    case 'high':
      return { label: 'High risk', className: 'bg-error-container text-on-error-container' };
    case 'medium':
      return { label: 'Medium risk', className: 'bg-warning-container text-on-warning-container' };
    case 'low':
      return { label: 'Low risk', className: 'bg-tertiary-container text-on-tertiary-container' };
  }
}
