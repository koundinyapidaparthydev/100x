import { useLocation, useNavigate } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { TrustStrip } from '../components/TrustStrip';

interface PiiRouteState {
  categories?: string[];
  issueKey?: string;
}

export function PiiBlocked() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state ?? {}) as PiiRouteState;
  const categories = state.categories ?? [];

  return (
    <div className="flex flex-col items-center justify-center h-full px-4 pb-20 w-full max-w-md mx-auto">
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-8 flex flex-col items-center text-center w-full shadow-sm">
        <div className="w-16 h-16 rounded-xl bg-warning-container flex items-center justify-center mb-6">
          <ShieldAlert className="w-8 h-8 text-on-warning-container" />
        </div>

        <h2 className="font-headline-md text-on-surface mb-2">Blocked by the PII firewall</h2>

        <p className="font-body-md text-on-surface-variant mb-4 leading-relaxed">
          {state.issueKey ? `Ticket ${state.issueKey}` : 'This ticket'} was stopped before any model
          call — its payload matched PII categories your policy blocks from AI. No data left your
          environment.
        </p>

        {categories.length > 0 && (
          <div className="flex flex-wrap justify-center gap-1.5 mb-6">
            {categories.map((category) => (
              <span
                key={category}
                className="px-2 py-0.5 rounded bg-warning-container text-on-warning-container font-mono text-[10px] uppercase tracking-widest"
              >
                {category}
              </span>
            ))}
          </div>
        )}

        <button className="w-full h-11 bg-primary text-on-primary font-sans font-semibold text-base rounded-lg flex items-center justify-center mb-2 hover:opacity-90 active:scale-[0.98] transition-all shadow-sm">
          Ask for Access
        </button>

        <button
          onClick={() => navigate('/app/triage')}
          className="w-full h-11 bg-transparent text-on-surface border border-outline font-sans font-semibold text-base rounded-lg flex items-center justify-center hover:bg-surface-container-low active:scale-[0.98] transition-all"
        >
          Return to Triage
        </button>
      </div>

      <TrustStrip className="mt-auto pt-8 w-full border-t border-outline-variant opacity-70" />
    </div>
  );
}
