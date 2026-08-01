import { Link, useLocation } from 'react-router-dom';
import { chipClassName } from './ui';

const SECTIONS = [
  { label: 'Defaults', to: '/governance/defaults', pathname: '/governance/defaults' },
  { label: 'PII & PCI', to: '/governance/pii', pathname: '/governance/pii' },
  { label: 'Model runtime', to: '/governance/runtime#models', pathname: '/governance/runtime', hash: '#models' },
  { label: 'Cloud runtime', to: '/governance/runtime#cloud', pathname: '/governance/runtime', hash: '#cloud' },
] as const;

export default function GovernanceNav() {
  const location = useLocation();
  const activeHash = location.pathname === '/governance/runtime' ? location.hash || '#models' : '';

  return (
    <nav
      aria-label="Governance workspace sections"
      className="flex max-w-full flex-wrap gap-2"
    >
      {SECTIONS.map((section) => {
        const active =
          location.pathname === section.pathname &&
          (!('hash' in section) || activeHash === section.hash);

        return (
          <Link
            key={section.to}
            to={section.to}
            aria-current={active ? 'page' : undefined}
            className={chipClassName({
              tone: 'primary',
              selected: active,
              className: 'no-underline',
            })}
          >
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
