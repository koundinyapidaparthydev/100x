import { ShieldCheck, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function Splash() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-between h-full bg-background p-4 relative overflow-hidden">
      {/* Ambient background */}
      <div className="absolute inset-0 z-0 pointer-events-none flex items-center justify-center opacity-10">
        <div className="w-[800px] h-[800px] rounded-full bg-primary-container blur-[100px]"></div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center w-full z-10 animate-slide-up">
        <div className="w-24 h-24 bg-surface-container rounded-2xl flex items-center justify-center mb-6 border border-outline-variant shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-primary"></div>
          <ShieldCheck className="w-12 h-12 text-primary" />
        </div>
        <h1 className="font-headline-lg text-on-surface mb-2 tracking-tight">OffshoreHelper</h1>
        <p className="font-body-md text-on-surface-variant text-center max-w-xs">
          AI-first work delegation
        </p>
      </div>

      <div className="w-full max-w-md z-10 animate-fade-in">
        <div className="flex items-center justify-center mb-6 gap-2">
          <Lock className="w-4 h-4 text-primary" />
          <span className="font-mono text-[10px] text-on-surface-variant uppercase tracking-[0.1em]">
            Every ticket passes the PII firewall before AI runs
          </span>
        </div>
        <button
          onClick={() => navigate('/login')}
          className="w-full h-12 bg-primary text-on-primary font-sans font-semibold text-lg rounded-lg hover:bg-primary-fixed active:scale-[0.98] transition-all shadow-sm flex items-center justify-center"
        >
          Get Started
        </button>
      </div>
    </div>
  );
}
