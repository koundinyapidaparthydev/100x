import { CircleHelp } from 'lucide-react';
import { cn } from '../../lib/utils';

type QuestionInfoProps = {
  text: string;
  className?: string;
};

/**
 * Visible help control for onboarding question labels.
 * Hover / focus shows plain-language guidance on what to pick.
 */
export function QuestionInfo({ text, className }: QuestionInfoProps) {
  return (
    <span className={cn('relative inline-flex align-middle', className)}>
      <span
        role="button"
        tabIndex={0}
        aria-label="More about this question"
        title="What this means"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        className={cn(
          'peer inline-flex size-5 shrink-0 cursor-help items-center justify-center rounded-full',
          'border border-outline-variant/80 bg-surface text-primary transition-colors',
          'hover:border-primary hover:bg-primary-container/60',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
        )}
      >
        <CircleHelp size={13} strokeWidth={2.25} aria-hidden="true" />
      </span>
      <span
        role="tooltip"
        className={cn(
          'pointer-events-none absolute left-0 top-full z-40 mt-2 w-72 max-w-[min(18rem,calc(100vw-2rem))]',
          'rounded-lg border border-outline-variant bg-surface px-3 py-2.5 text-left text-[12px] font-normal leading-4 text-on-surface shadow-lg',
          'opacity-0 transition-opacity duration-150',
          'peer-hover:opacity-100 peer-focus-visible:opacity-100',
        )}
      >
        {text}
      </span>
    </span>
  );
}

export function QuestionLabel({
  label,
  info,
}: {
  label: string;
  info?: string;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <span>{label}</span>
      {info ? <QuestionInfo text={info} /> : null}
    </span>
  );
}
