import { cn } from '../lib/utils';

/** AAI mark — logo-only monogram. Company name remains 100x. */
const MARK_SRC = '/brand/aai-mark.svg';

type BrandLogoProps = {
  className?: string;
  /** Icon size in px (square). */
  size?: number;
  /** Show “100x” wordmark beside the mark. */
  withWordmark?: boolean;
  wordmarkClassName?: string;
};

/** Official 100x logo: AAI mark (+ optional 100x wordmark). */
export function BrandLogo({
  className,
  size = 32,
  withWordmark = false,
  wordmarkClassName,
}: BrandLogoProps) {
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
          100x
        </span>
      ) : null}
    </span>
  );
}
