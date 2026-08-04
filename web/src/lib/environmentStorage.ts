const ACTIVE_ENV_KEY = 'aplifyai-active-environment';
export const ACTIVE_ENV_CHANGED_EVENT = 'aplifyai:active-environment';

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

export function writeCachedActiveEnvironmentId(environmentId: string): void {
  localStorage.setItem(
    ACTIVE_ENV_KEY,
    JSON.stringify({ environmentId, updatedAt: new Date().toISOString() }),
  );
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(ACTIVE_ENV_CHANGED_EVENT, { detail: { environmentId } }),
    );
  }
}

export function clearCachedActiveEnvironmentId(): void {
  localStorage.removeItem(ACTIVE_ENV_KEY);
}
