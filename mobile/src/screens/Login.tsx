import { ClipboardList, LogIn, Fingerprint } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { TrustStrip } from '../components/TrustStrip';

export function Login() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-between h-full bg-surface-container-lowest p-4">
      {/* Top Spacer */}
      <div className="h-16"></div>

      <main className="flex-1 flex flex-col items-center justify-center w-full max-w-md mx-auto">
        {/* Brand */}
        <div className="flex flex-col items-center text-center space-y-2 mb-8 animate-slide-up">
          <div className="w-16 h-16 bg-surface-container rounded-2xl border border-outline-variant flex items-center justify-center mb-2">
            <ClipboardList className="w-8 h-8 text-primary" />
          </div>
          <h1 className="font-headline-lg text-on-surface tracking-tight">OffshoreHelper</h1>
          <p className="font-body-md text-on-surface-variant max-w-[300px]">
            Triage your Jira queue in seconds — swipe tickets AI-first or human-first, under your
            org's policy and token budgets.
          </p>
        </div>

        {/* Actions */}
        <div className="w-full flex flex-col space-y-4 animate-fade-in">
          <button
            onClick={() => navigate('/app')}
            className="w-full h-12 bg-primary text-on-primary font-sans font-semibold text-lg rounded-lg flex items-center justify-center space-x-2 active:opacity-80 transition-opacity"
          >
            <LogIn className="w-5 h-5" />
            <span>Sign in with SSO</span>
          </button>

          <div className="flex items-center space-x-2 w-full py-2">
            <div className="flex-1 h-px bg-outline-variant opacity-50"></div>
            <span className="font-mono text-xs text-on-surface-variant uppercase tracking-wider">
              Or unlock with
            </span>
            <div className="flex-1 h-px bg-outline-variant opacity-50"></div>
          </div>

          <button
            onClick={() => navigate('/app')}
            className="w-full h-12 border border-outline-variant text-primary font-sans font-semibold text-lg rounded-lg flex items-center justify-center space-x-2 hover:bg-surface-container-low active:bg-surface-container transition-colors"
          >
            <Fingerprint className="w-5 h-5" />
            <span>Biometric Login</span>
          </button>

          <p className="font-body-sm text-on-surface-variant text-center pt-2">
            For engineering managers. Sessions are short-lived and can be revoked from web admin.
          </p>
        </div>
      </main>

      {/* Footer TrustStrip */}
      <footer className="w-full py-4 flex justify-center pb-safe">
        <TrustStrip />
      </footer>
    </div>
  );
}
