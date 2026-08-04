/** Human-readable labels for built-in environment keys. */
const BUILTIN_LABELS: Record<string, string> = {
  prod: 'Production',
  production: 'Production',
  stage: 'Staging',
  staging: 'Staging',
  dev: 'Development',
  development: 'Development',
};

/** Tone for status dots in the environment switcher. */
export type EnvironmentTone = 'prod' | 'stage' | 'dev' | 'custom';

export function environmentDisplayName(name: string, key?: string): string {
  const fromKey = key ? BUILTIN_LABELS[key.toLowerCase()] : undefined;
  if (fromKey) return fromKey;
  const fromName = BUILTIN_LABELS[name.trim().toLowerCase()];
  if (fromName) return fromName;
  // Expand short seeded names that may still be stored as Prod/Stage/Dev.
  if (name === 'Prod') return 'Production';
  if (name === 'Stage') return 'Staging';
  if (name === 'Dev') return 'Development';
  return name;
}

export function environmentTone(key: string): EnvironmentTone {
  const k = key.toLowerCase();
  if (k === 'prod' || k === 'production') return 'prod';
  if (k === 'stage' || k === 'staging') return 'stage';
  if (k === 'dev' || k === 'development') return 'dev';
  return 'custom';
}

export const ENVIRONMENT_TONE_DOT: Record<EnvironmentTone, string> = {
  prod: 'bg-success',
  stage: 'bg-butter',
  dev: 'bg-mint',
  custom: 'bg-on-surface-variant',
};
