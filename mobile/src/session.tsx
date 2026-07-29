import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { AuthSession } from '@shared/types';
import { api, setSessionToken } from './api';

const SESSION_KEY = 'aplifyai.mobile.session';

interface SessionContextValue {
  session: AuthSession | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void SecureStore.getItemAsync(SESSION_KEY)
      .then((raw) => {
        if (!raw) return;
        const saved = JSON.parse(raw) as AuthSession;
        if (new Date(saved.expiresAt).getTime() <= Date.now()) return;
        setSessionToken(saved.token);
        setSession(saved);
      })
      .catch(() => SecureStore.deleteItemAsync(SESSION_KEY))
      .finally(() => setLoading(false));
  }, []);

  const signIn = useCallback(async () => {
    const result = await api.login('manager');
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(result.session));
    setSession(result.session);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setSessionToken(null);
      setSession(null);
      await SecureStore.deleteItemAsync(SESSION_KEY);
    }
  }, []);

  const value = useMemo(
    () => ({ session, loading, signIn, signOut }),
    [session, loading, signIn, signOut],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider');
  return value;
}
