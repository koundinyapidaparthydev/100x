/** Display helpers shared across pages. */

export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function formatNumber(n: number): string {
  return n.toLocaleString();
}

/** snake_case / dot.case -> Title Case words */
export function humanize(value: string): string {
  return value
    .split(/[_.]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

const PROVIDER_NAMES: Record<string, string> = {
  aws: 'Amazon Web Services',
  azure: 'Microsoft Azure',
  gcp: 'Google Cloud',
  nvidia: 'NVIDIA (DGX / NGC)',
  private: 'Generic private cloud',
  custom: 'Other platform',
};

export function providerDisplay(provider: string, customLabel?: string): string {
  if (provider === 'custom' && customLabel?.trim()) return customLabel.trim();
  return PROVIDER_NAMES[provider] ?? humanize(provider);
}

const CLOUD_MODES: Record<string, string> = {
  /** AplifyAI-hosted managed private plane — no customer cloud account required. */
  public_managed: 'AplifyAI private cloud',
  /** Bring-your-own-cloud — customer picks platform and connects their account. */
  private_vpc: 'Your cloud (BYOC)',
  /** Execute in cloud accounts already linked (AWS / Azure / GCP / NVIDIA). */
  customer_cloud: 'Connected cloud accounts',
};

export function cloudModeDisplay(mode: string): string {
  return CLOUD_MODES[mode] ?? humanize(mode);
}

const ROLE_LABELS: Record<string, string> = {
  founder: 'Workspace owner',
  manager: 'Delivery lead',
  engineer: 'Contributor',
  auditor: 'Auditor',
};

export function roleDisplay(role: string): string {
  return ROLE_LABELS[role] ?? humanize(role);
}

/** Demo seat accounts use usr-* ids; federated ids are namespaced (google:…). */
export function isDemoSeatSession(userId: string | undefined | null): boolean {
  return !!userId?.startsWith('usr-');
}
