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
  private: 'Private Cloud',
};

export function providerDisplay(provider: string): string {
  return PROVIDER_NAMES[provider] ?? humanize(provider);
}

const CLOUD_MODES: Record<string, string> = {
  public_managed: 'Public Managed',
  private_vpc: 'Private VPC',
  customer_cloud: 'Customer Cloud',
};

export function cloudModeDisplay(mode: string): string {
  return CLOUD_MODES[mode] ?? humanize(mode);
}
