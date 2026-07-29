import SecurityStatusLine from './SecurityStatus';

export default function Footer() {
  return (
    <footer className="fixed bottom-0 right-0 left-0 md:left-[280px] bg-surface-container-lowest border-t border-outline-variant flex justify-between items-center px-xl py-sm z-40 transition-opacity duration-300">
      <SecurityStatusLine />
      <div className="hidden sm:flex gap-lg shrink-0">
        <a href="#" className="font-label-sm text-label-sm text-on-surface-variant hover:text-tertiary transition-colors">
          Security Policy
        </a>
        <a href="#" className="font-label-sm text-label-sm text-on-surface-variant hover:text-tertiary transition-colors">
          Audit Protocols
        </a>
      </div>
    </footer>
  );
}
