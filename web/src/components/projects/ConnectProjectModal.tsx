import { X } from 'lucide-react';

const inputClass =
  'w-full h-9 bg-surface-variant border border-outline-variant/50 rounded text-body-sm text-on-surface px-3 outline-none focus:border-outline-variant';

export interface ConnectProjectModalProps {
  projectId: string;
  boardName: string;
  busy: boolean;
  error: string | null;
  onProjectIdChange: (value: string) => void;
  onBoardNameChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}

export function ConnectProjectModal({
  projectId,
  boardName,
  busy,
  error,
  onProjectIdChange,
  onBoardNameChange,
  onClose,
  onSubmit,
}: ConnectProjectModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-margin" data-testid="boards-connect-modal">
      <div className="flex w-full max-w-md flex-col gap-md rounded-xl border border-outline-variant bg-surface-container p-lg shadow-lg">
        <div className="flex items-center justify-between">
          <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface">Connect project</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-sm text-on-surface-variant hover:bg-surface-variant"
            data-testid="boards-connect-close"
          >
            <X size={18} />
          </button>
        </div>
        {error && (
          <p className="font-body-sm text-body-sm text-error" data-testid="boards-action-error" role="alert">
            {error}
          </p>
        )}
        <label className="flex flex-col gap-xs">
          <span className="font-label-sm text-label-sm text-on-surface-variant">Project ID</span>
          <input
            className={inputClass}
            value={projectId}
            placeholder="e.g. ACME"
            onChange={(e) => onProjectIdChange(e.target.value)}
            data-testid="boards-connect-project-id"
          />
        </label>
        <label className="flex flex-col gap-xs">
          <span className="font-label-sm text-label-sm text-on-surface-variant">Board name</span>
          <input
            className={inputClass}
            value={boardName}
            placeholder="e.g. Platform Engineering"
            onChange={(e) => onBoardNameChange(e.target.value)}
            data-testid="boards-connect-name"
          />
        </label>
        <div className="flex justify-end gap-sm pt-sm">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-outline-variant px-md py-sm font-label-md text-label-md text-on-surface hover:bg-surface-variant"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onSubmit}
            data-testid="boards-connect-submit"
            className="rounded bg-tertiary px-md py-sm font-label-md text-label-md font-bold text-on-tertiary hover:bg-tertiary-fixed disabled:opacity-50"
          >
            {busy ? 'Connecting…' : 'Connect'}
          </button>
        </div>
      </div>
    </div>
  );
}
