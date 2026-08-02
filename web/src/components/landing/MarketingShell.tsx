import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Button } from '../ui';
import { MarketingFooter } from './MarketingFooter';
import { MarketingWidth } from './MarketingWidth';

const NAV = [
  { to: '/how-it-works', label: 'How it works' },
  { to: '/features', label: 'Features' },
  { to: '/platforms', label: 'Platforms' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/blog', label: 'Blog' },
] as const;

const WASH =
  'radial-gradient(ellipse 90% 55% at 8% -5%, color-mix(in srgb, var(--color-mint-container) 75%, transparent), transparent 58%), radial-gradient(ellipse 70% 45% at 95% 5%, color-mix(in srgb, var(--color-butter-container) 70%, transparent), transparent 52%), radial-gradient(ellipse 50% 35% at 50% 100%, color-mix(in srgb, var(--color-primary-container) 45%, transparent), transparent 60%)';

function navClass(isActive: boolean) {
  return `rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
    isActive
      ? 'bg-primary-container text-on-primary-container'
      : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
  }`;
}

export function MarketingShell({
  children,
  testId,
}: {
  children: ReactNode;
  testId?: string;
}) {
  return (
    <div
      className="flex min-h-screen flex-col bg-background text-on-surface"
      data-testid={testId}
      style={{ backgroundImage: WASH }}
    >
      <MarketingWidth
        as="nav"
        className="flex items-center justify-between gap-4 py-4"
      >
        <Link to="/" className="font-serif text-lg tracking-tight text-on-surface">
          AplifyAI
        </Link>
        <div className="flex min-w-0 items-center justify-end gap-1 sm:gap-2">
          <div className="hidden items-center gap-1 lg:flex">
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => navClass(isActive)}>
                {item.label}
              </NavLink>
            ))}
          </div>
          <Link to="/login" className="hidden sm:inline-flex">
            <Button variant="quiet">Log in</Button>
          </Link>
          <Link to="/signup">
            <Button variant="primary">Sign up</Button>
          </Link>
        </div>
      </MarketingWidth>

      <MarketingWidth className="flex gap-1 overflow-x-auto pb-2 lg:hidden">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `shrink-0 ${navClass(isActive)} py-1.5`}
          >
            {item.label}
          </NavLink>
        ))}
        <Link to="/login" className={`shrink-0 ${navClass(false)} py-1.5 sm:hidden`}>
          Log in
        </Link>
      </MarketingWidth>

      <div className="flex-1">{children}</div>
      <MarketingFooter />
    </div>
  );
}
