import type { ReactNode } from 'react';
import { Button } from './Button';

export interface SaveBarProps {
  dirty: boolean;
  saving?: boolean;
  message?: ReactNode;
  onSave: () => void;
  onDiscard?: () => void;
}

export function SaveBar({ dirty, saving = false, message, onSave, onDiscard }: SaveBarProps) {
  if (!dirty && !saving) return null;
  return (
    <div
      className="sticky bottom-3 z-20 mt-5 flex flex-col gap-3 rounded-xl border border-outline-variant bg-surface p-3 shadow-lg sm:flex-row sm:items-center sm:justify-between"
      role="region"
      aria-label="Unsaved changes"
    >
      <p className="text-sm text-on-surface-variant">{message ?? 'You have unsaved changes.'}</p>
      <div className="flex items-center justify-end gap-2">
        {onDiscard && (
          <Button variant="quiet" onClick={onDiscard} disabled={saving}>
            Discard
          </Button>
        )}
        <Button onClick={onSave} loading={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </div>
  );
}
