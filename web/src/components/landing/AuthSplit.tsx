import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';

const WASH =
  'radial-gradient(ellipse 80% 60% at 10% 0%, color-mix(in srgb, var(--color-mint-container) 70%, transparent), transparent 55%), radial-gradient(ellipse 55% 45% at 90% 20%, color-mix(in srgb, var(--color-butter-container) 55%, transparent), transparent 50%)';

export function AuthSplit({
  eyebrow,
  title,
  body,
  bullets,
  children,
  testId,
}: {
  eyebrow: string;
  title: string;
  body: string;
  bullets: string[];
  children: ReactNode;
  testId: string;
}) {
  return (
    <div className="min-h-screen bg-background text-on-surface lg:grid lg:grid-cols-2" data-testid={testId}>
      <aside
        className="relative flex flex-col px-6 py-8 sm:px-10 lg:min-h-screen lg:px-12 lg:py-10"
        style={{ backgroundImage: WASH }}
      >
        <Link to="/" className="font-serif text-lg tracking-tight text-on-surface">
          AplifyAI
        </Link>
        <div className="mt-12 flex flex-1 flex-col justify-center lg:mt-0 lg:max-w-lg">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
            {eyebrow}
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl lg:text-[2.5rem] lg:leading-[1.15]">
            {title}
          </h1>
          <p className="mt-4 text-base leading-7 text-on-surface-variant">{body}</p>
          <ul className="mt-6 space-y-3 text-sm text-on-surface-variant">
            {bullets.map((item) => (
              <li key={item} className="flex gap-2.5">
                <Check size={17} className="mt-0.5 shrink-0 text-mint" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="mt-10 hidden text-sm text-on-surface-variant lg:block">
          <Link to="/" className="font-semibold text-primary hover:underline">
            ← Back to home
          </Link>
        </p>
      </aside>

      <main className="flex items-center justify-center border-t border-outline-variant/60 bg-surface px-6 py-12 sm:px-10 lg:border-t-0 lg:border-l lg:px-12 lg:py-10">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
