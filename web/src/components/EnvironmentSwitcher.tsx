import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '@shared/api';
import type { WorkspaceEnvironment, WorkspaceEnvironmentState } from '@shared/types';
import {
  ENVIRONMENT_TONE_DOT,
  environmentDisplayName,
  environmentTone,
} from '../lib/environmentLabels';
import {
  ACTIVE_ENV_CHANGED_EVENT,
  commitActiveEnvironmentId,
  readCachedActiveEnvironmentId,
  writeCachedActiveEnvironmentId,
} from '../lib/environmentStorage';
import { readDemoSession } from '../lib/session';
import { cn } from '../lib/utils';

type EnvironmentSwitcherProps = {
  /** Compact layout for the mobile drawer. */
  variant?: 'header' | 'drawer';
  className?: string;
  onNavigated?: () => void;
};

/** Shared across Topbar/Sidebar mounts so only one listEnvironments flight runs. */
let sharedState: WorkspaceEnvironmentState | null = null;
let sharedInflight: Promise<WorkspaceEnvironmentState> | null = null;

function loadSharedEnvironments(force = false): Promise<WorkspaceEnvironmentState> {
  if (!force && sharedState) return Promise.resolve(sharedState);
  if (!force && sharedInflight) return sharedInflight;
  sharedInflight = api
    .listEnvironments()
    .then((res) => {
      sharedState = res;
      sharedInflight = null;
      return res;
    })
    .catch((err) => {
      sharedInflight = null;
      throw err;
    });
  return sharedInflight;
}

function applySharedActive(environmentId: string): void {
  if (!sharedState) return;
  sharedState = { ...sharedState, activeEnvironmentId: environmentId };
}

export default function EnvironmentSwitcher({
  variant = 'header',
  className,
  onNavigated,
}: EnvironmentSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<WorkspaceEnvironmentState | null>(() => sharedState);
  const menuRef = useRef<HTMLDivElement>(null);
  const session = readDemoSession();

  useEffect(() => {
    if (!session) {
      setState(null);
      return;
    }
    let cancelled = false;
    void loadSharedEnvironments()
      .then((res) => {
        if (cancelled) return;
        setState(res);
        // Hydrate cache without notifying listeners — user did not switch env.
        writeCachedActiveEnvironmentId(res.activeEnvironmentId, { emit: false });
      })
      .catch(() => {
        if (!cancelled) setState(null);
      });
    return () => {
      cancelled = true;
    };
  }, [session?.token, session?.id]);

  // Stay in sync when another surface (console page / other mount) changes active env.
  useEffect(() => {
    const onEnv = (event: Event) => {
      const environmentId = (event as CustomEvent<{ environmentId?: string }>).detail?.environmentId;
      if (!environmentId) return;
      applySharedActive(environmentId);
      setState((prev) =>
        prev ? { ...prev, activeEnvironmentId: environmentId } : prev,
      );
    };
    window.addEventListener(ACTIVE_ENV_CHANGED_EVENT, onEnv);
    return () => window.removeEventListener(ACTIVE_ENV_CHANGED_EVENT, onEnv);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const cachedId = readCachedActiveEnvironmentId();
  const active: WorkspaceEnvironment | undefined =
    state?.environments.find((e) => e.id === state.activeEnvironmentId) ??
    state?.environments.find((e) => e.id === cachedId) ??
    state?.environments[0];

  const select = async (environmentId: string) => {
    if (!state || environmentId === state.activeEnvironmentId || busy) return;
    setBusy(true);
    const previous = state;
    const optimistic = { ...state, activeEnvironmentId: environmentId };
    setState(optimistic);
    applySharedActive(environmentId);
    // Single writer for user-driven switches (immediate notify).
    commitActiveEnvironmentId(environmentId);
    setOpen(false);
    try {
      const next = await api.setActiveEnvironment({ environmentId });
      sharedState = next;
      setState(next);
      writeCachedActiveEnvironmentId(next.activeEnvironmentId, { emit: false });
    } catch {
      sharedState = previous;
      setState(previous);
      commitActiveEnvironmentId(previous.activeEnvironmentId);
    } finally {
      setBusy(false);
    }
  };

  if (!session) return null;

  const label = active
    ? environmentDisplayName(active.name, active.key)
    : 'Environment';
  const tone = active ? environmentTone(active.key) : 'custom';

  return (
    <div className={cn('relative', className)} ref={menuRef} data-testid="environment-switcher">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Workspace environment: ${label}`}
        disabled={busy && !state}
        onClick={() => setOpen((v) => !v)}
        data-testid="environment-switcher-trigger"
        className={cn(
          'inline-flex min-h-9 max-w-[14rem] items-center gap-2 rounded-lg border px-2.5 text-sm font-medium transition-colors',
          variant === 'drawer'
            ? 'w-full max-w-none justify-between border-outline-variant bg-surface-container-low text-on-surface hover:bg-surface-container-high'
            : 'border-outline-variant/80 bg-surface-container-low text-on-surface hover:border-primary/35 hover:bg-surface',
          open && 'border-primary/40 bg-surface text-on-surface',
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span
            className={cn('size-2 shrink-0 rounded-full', ENVIRONMENT_TONE_DOT[tone])}
            aria-hidden="true"
          />
          <span className="truncate">{busy && !active ? '…' : label}</span>
        </span>
        <ChevronDown size={14} className="shrink-0 opacity-70" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          data-testid="environment-switcher-menu"
          className={cn(
            'z-40 rounded-xl border border-outline-variant bg-surface p-1.5 shadow-md',
            variant === 'drawer' ? 'relative mt-1 w-full' : 'absolute left-0 top-full mt-1 w-64',
          )}
        >
          <p className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-on-surface-variant">
            Workspace environment
          </p>
          <p className="px-2.5 pb-2 text-xs leading-4 text-on-surface-variant">
            Scope for configs and delivery work. Switch when promoting across Production, Staging, or Development.
          </p>
          {(state?.environments ?? []).length === 0 ? (
            <p className="px-2.5 py-3 text-sm text-on-surface-variant" data-testid="environment-empty">
              No environments assigned. Ask a workspace owner to grant you access.
            </p>
          ) : (
            (state?.environments ?? []).map((env) => {
            const isActive = env.id === (state?.activeEnvironmentId ?? active?.id);
            const display = environmentDisplayName(env.name, env.key);
            const envTone = environmentTone(env.key);
            return (
              <button
                key={env.id}
                type="button"
                role="menuitem"
                data-testid={`environment-option-${env.key}`}
                disabled={busy}
                onClick={() => void select(env.id)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
                  isActive
                    ? 'bg-primary-container/70 font-semibold text-on-primary-container'
                    : 'text-on-surface hover:bg-surface-container',
                )}
              >
                <span
                  className={cn('size-2 shrink-0 rounded-full', ENVIRONMENT_TONE_DOT[envTone])}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 truncate">{display}</span>
                <span className="font-mono text-[10px] text-on-surface-variant">{env.key}</span>
              </button>
            );
          })
          )}
          <div className="mt-1 border-t border-outline-variant pt-1">
            <Link
              to="/console/environments"
              role="menuitem"
              data-testid="environment-manage-link"
              onClick={() => {
                setOpen(false);
                onNavigated?.();
              }}
              className="flex w-full rounded-lg px-2.5 py-2 text-sm text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
            >
              Manage environments…
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
