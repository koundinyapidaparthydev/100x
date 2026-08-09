import { cn } from '../lib/utils';

/** AAI mark — logo-only monogram. Company name remains AplifyAI. */
const MARK_SRC = '/brand/aai-mark.svg';

type AplifyLogoProps = {
  className?: string;
  /** Icon size in px (square). */
  size?: number;
  /** Show “AplifyAI” wordmark beside the mark. */
  withWordmark?: boolean;
  wordmarkClassName?: string;
};

/** Official AplifyAI logo: AAI mark (+ optional AplifyAI wordmark). */
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
