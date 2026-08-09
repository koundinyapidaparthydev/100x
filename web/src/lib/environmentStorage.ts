const ACTIVE_ENV_KEY = 'aplifyai-active-environment';
export const ACTIVE_ENV_CHANGED_EVENT = 'aplifyai:active-environment';

/** Coalesce rapid writers (hydrate + confirm) into one listener notification. */
const ENV_CHANGE_DEBOUNCE_MS = 50;

let pendingDispatch: ReturnType<typeof setTimeout> | null = null;
let pendingEmitId: string | null = null;
let lastDispatchedId: string | null = null;

export type WriteCachedActiveEnvironmentOptions = {
  /**
   * When false, update localStorage only (no CustomEvent).
   * Use for hydrate / echo writes so Connections does not reload from its own refresh.
   * Default: emit (debounced) only when the cached id actually changes.
   */
  emit?: boolean;
};

export function readCachedActiveEnvironmentId(): string | null {
  try {
    const raw = localStorage.getItem(ACTIVE_ENV_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { environmentId?: string };
    return parsed.environmentId ?? null;
  } catch {
    return null;
  }
}

function persistActiveEnvironmentId(environmentId: string): void {
  localStorage.setItem(
    ACTIVE_ENV_KEY,
    JSON.stringify({ environmentId, updatedAt: new Date().toISOString() }),
  );
}

function dispatchActiveEnvironmentChanged(environmentId: string): void {
  if (typeof window === 'undefined') return;
  if (lastDispatchedId === environmentId) return;
  lastDispatchedId = environmentId;
  window.dispatchEvent(
    new CustomEvent(ACTIVE_ENV_CHANGED_EVENT, { detail: { environmentId } }),
  );
}

function scheduleEmit(environmentId: string): void {
  if (typeof window === 'undefined') return;
  pendingEmitId = environmentId;
  if (pendingDispatch) clearTimeout(pendingDispatch);
  pendingDispatch = setTimeout(() => {
    pendingDispatch = null;
    const id = pendingEmitId;
    pendingEmitId = null;
    if (id) dispatchActiveEnvironmentChanged(id);
  }, ENV_CHANGE_DEBOUNCE_MS);
}

/**
 * Persist the active environment id.
 * Emits `ACTIVE_ENV_CHANGED_EVENT` only when the id changes (unless `emit: false`).
 */
export function writeCachedActiveEnvironmentId(
  environmentId: string,
  options?: WriteCachedActiveEnvironmentOptions,
): void {
  const previous = readCachedActiveEnvironmentId();
  const changed = previous !== environmentId;
  persistActiveEnvironmentId(environmentId);

  if (options?.emit === false) return;
  if (!changed && options?.emit !== true) return;
  scheduleEmit(environmentId);
}

/** Immediate write + notify — used when the user explicitly switches env. */
export function commitActiveEnvironmentId(environmentId: string): void {
  if (pendingDispatch) {
    clearTimeout(pendingDispatch);
    pendingDispatch = null;
  }
  pendingEmitId = null;
  persistActiveEnvironmentId(environmentId);
  // Allow re-notify even if lastDispatched matched (e.g. after rollback then re-select).
  lastDispatchedId = null;
  dispatchActiveEnvironmentChanged(environmentId);
}

export function clearCachedActiveEnvironmentId(): void {
  if (pendingDispatch) {
    clearTimeout(pendingDispatch);
    pendingDispatch = null;
  }
  pendingEmitId = null;
  lastDispatchedId = null;
  localStorage.removeItem(ACTIVE_ENV_KEY);
}
