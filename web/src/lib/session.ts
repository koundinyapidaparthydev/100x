import { clearSession, setApiActor, setSessionToken } from '@shared/api';
import { clearOnboardingProfile } from './onboardingStorage';

export const DEMO_SESSION_KEY = 'aplifyai-demo-session';

export type DemoSession = {
  token: string;
  id: string;
  role: string;
  surface: 'web' | 'mobile';
};

export function readDemoSession(): DemoSession | null {
  try {
    const raw = localStorage.getItem(DEMO_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DemoSession>;
    if (!parsed.token || !parsed.id) return null;
    return {
      token: parsed.token,
      id: parsed.id,
      role: parsed.role ?? 'manager',
      surface: parsed.surface === 'mobile' ? 'mobile' : 'web',
    };
  } catch {
    return null;
  }
}

export function writeDemoSession(session: DemoSession): void {
  localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(session));
  setSessionToken(session.token);
  setApiActor(session.id, session.surface);
}

export function applyDemoSessionToApi(session: DemoSession | null): void {
  if (!session) {
    clearSession();
    return;
  }
  setSessionToken(session.token);
  setApiActor(session.id, session.surface);
}

export function clearDemoSession(): void {
  localStorage.removeItem(DEMO_SESSION_KEY);
  clearOnboardingProfile();
  clearSession();
}
