import { useEffect } from 'react';
import { ShieldCheck, Lock, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { setApiActor } from '@shared/api';

const DEMO_SESSION_KEY = 'oh-demo-actor';

export default function Login() {
  const navigate = useNavigate();

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DEMO_SESSION_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { id?: string; surface?: 'web' | 'mobile' };
      if (parsed.id) {
        setApiActor(parsed.id, parsed.surface ?? 'web');
      }
    } catch {
      /* ignore corrupt demo session */
    }
  }, []);

  const handleSso = () => {
    setApiActor('web-admin-1', 'web');
    try {
      localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify({ id: 'web-admin-1', surface: 'web' }));
    } catch {
      /* private mode / blocked storage */
    }
    navigate('/dashboard');
  };

  return (
    <div className="bg-surface-dim text-on-surface font-body-md min-h-screen flex flex-col relative mesh-background">
      <main className="flex-grow flex flex-col items-center justify-center relative z-10 px-margin">
        <div className="flex flex-col items-center text-center max-w-[800px] w-full">
          <div className="flex items-center gap-sm mb-2xl">
            <ShieldCheck className="text-tertiary" size={32} fill="currentColor" />
            <span className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
              OffshoreHelper
            </span>
          </div>

          <h1 className="font-display-lg text-display-lg text-on-surface mb-lg leading-tight">
            Autonomous Jira Delegation.
          </h1>

          <p className="font-body-lg text-body-lg text-on-surface-variant max-w-[600px] mb-3xl">
            AI-first project management engineered for high-stakes enterprise scale. Secure, precise, and fully accountable.
          </p>

          <button
            type="button"
            onClick={handleSso}
            className="bg-tertiary hover:bg-tertiary-fixed text-on-tertiary font-label-md text-label-md px-xl py-[16px] rounded-full transition-all duration-200 flex items-center justify-center gap-sm group shadow-[0_0_20px_rgba(59,130,246,0.1)] hover:shadow-[0_0_30px_rgba(59,130,246,0.2)]"
          >
            <Lock size={18} />
            <span>Login / SSO with Enterprise ID</span>
            <ArrowRight size={18} className="group-hover:translate-x-xs transition-transform duration-200" />
          </button>
          <p className="font-label-sm text-label-sm text-on-surface-variant mt-md">
            Demo mode — real SSO/vault in H1 · actor web-admin-1
          </p>
        </div>
      </main>

      <footer className="bg-surface-container-lowest border-t border-outline-variant flex justify-between items-center px-xl py-sm w-full z-10">
        <div className="flex items-center gap-sm">
          <Lock size={16} className="text-tertiary animate-pulse" fill="currentColor" />
          <span className="font-label-sm text-label-sm text-tertiary uppercase tracking-wider">
            Encryption Active | Model: GPT-4o-Enterprise | Cloud: Azure East US | PII Redaction: Enabled
          </span>
        </div>
        <div className="flex items-center gap-lg">
          <a href="#" className="font-label-sm text-label-sm text-on-surface-variant hover:text-tertiary transition-colors duration-200">
            Security Policy
          </a>
          <a href="#" className="font-label-sm text-label-sm text-on-surface-variant hover:text-tertiary transition-colors duration-200">
            Audit Protocols
          </a>
        </div>
      </footer>
    </div>
  );
}
