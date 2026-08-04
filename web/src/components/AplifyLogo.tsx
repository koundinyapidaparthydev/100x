import { cn } from '../lib/utils';

const MARK_SRC = '/brand/aplifyai-mark.svg';

type AplifyLogoProps = {
  className?: string;
  /** Icon size in px (square). */
  size?: number;
  /** Show “AplifyAI” wordmark beside the mark. */
  withWordmark?: boolean;
  wordmarkClassName?: string;
};

/** Official AplifyAI mark (+ optional wordmark). */
export function AplifyLogo({
  className,
  size = 32,
  withWordmark = false,
  wordmarkClassName,
}: AplifyLogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <img
        src={MARK_SRC}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-[22%]"
        decoding="async"
      />
      {withWordmark ? (
        <span
          className={cn(
            'text-base font-semibold tracking-tight text-on-surface',
            wordmarkClassName,
          )}
        >
          AplifyAI
        </span>
      ) : null}
    </span>
  );
}
