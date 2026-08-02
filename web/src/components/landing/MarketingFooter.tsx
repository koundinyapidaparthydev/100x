import { Link } from 'react-router-dom';
import { MarketingWidth } from './MarketingWidth';

const PRODUCT = [
  { to: '/how-it-works', label: 'How it works' },
  { to: '/platforms', label: 'Platforms' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/blog', label: 'Blog' },
] as const;

const ACCOUNT = [
  { to: '/login', label: 'Log in' },
  { to: '/signup', label: 'Sign up' },
] as const;

function FooterLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="text-sm text-on-surface-variant transition-colors hover:text-on-surface"
    >
      {label}
    </Link>
  );
}

export function MarketingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer
      className="mt-auto border-t border-outline-variant/60"
      data-testid="marketing-footer"
    >
      <MarketingWidth className="flex flex-col gap-10 py-12 sm:py-14 lg:flex-row lg:justify-between lg:gap-16">
        <div className="max-w-sm">
          <Link to="/" className="font-serif text-lg tracking-tight text-on-surface">
            AplifyAI
          </Link>
          <p className="mt-3 text-sm leading-6 text-on-surface-variant">
            Connect your board, decide AI vs human, and keep drafts behind a PII firewall before
            anything moves forward.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-10 sm:gap-14 lg:gap-16">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
              Product
            </p>
            <ul className="mt-4 flex flex-col gap-2.5">
              {PRODUCT.map((item) => (
                <li key={item.to}>
                  <FooterLink {...item} />
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
              Account
            </p>
            <ul className="mt-4 flex flex-col gap-2.5">
              {ACCOUNT.map((item) => (
                <li key={item.to}>
                  <FooterLink {...item} />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </MarketingWidth>

      <div className="border-t border-outline-variant/50">
        <MarketingWidth className="flex flex-col gap-2 py-5 text-xs text-on-surface-variant sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} AplifyAI. Free workspace — no card required.</p>
          <p className="sm:text-right">Boards stay the system of record.</p>
        </MarketingWidth>
      </div>
    </footer>
  );
}
