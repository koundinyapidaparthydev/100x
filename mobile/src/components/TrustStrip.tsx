import { ShieldCheck } from 'lucide-react';
import { cn } from '../lib/utils';

/**
 * Shared trust strip used across screens — reassures managers that the
 * encryption + PII firewall layers are active before any AI action.
 */
export function TrustStrip({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex items-center justify-center gap-2 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-on-surface-variant',
        className,
      )}
    >
      <ShieldCheck className="w-3.5 h-3.5 text-primary" />
      <span>Encryption active • PII firewall on</span>
    </div>
  );
}
