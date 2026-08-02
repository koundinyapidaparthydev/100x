import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { AuthSession, FederatedAuthProvider } from '@shared/types';
import { api, setSessionToken } from './api';

WebBrowser.maybeCompleteAuthSession();

const SESSION_KEY = 'aplifyai.mobile.session';
const MOBILE_REDIRECT = 'aplifyai://auth/callback';

interface SessionContextValue {
  session: AuthSession | null;
  loading: boolean;
  signIn: (identity?: string) => Promise<void>;
  signInWithProvider: (provider: FederatedAuthProvider) => Promise<void>;
  completeFederatedExchange: (exchange: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

async function persistSession(next: AuthSession) {
  setSessionToken(next.token);
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(next));
}

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

  const signIn = useCallback(async (identity = 'manager') => {
    const result = await api.login(identity);
    await persistSession(result.session);
    setSession(result.session);
  }, []);

  const completeFederatedExchange = useCallback(async (exchange: string) => {
    const result = await api.federatedExchange(exchange);
    await persistSession(result.session);
    setSession(result.session);
  }, []);

  const signInWithProvider = useCallback(
    async (provider: FederatedAuthProvider) => {
      const startUrl = api.authStartUrl(provider, 'login');
      const result = await WebBrowser.openAuthSessionAsync(startUrl, MOBILE_REDIRECT);
      if (result.type !== 'success' || !result.url) {
        if (result.type === 'cancel' || result.type === 'dismiss') {
          throw new Error('Sign-in cancelled');
        }
        throw new Error('Sign-in did not complete');
      }
      const url = new URL(result.url);
      const err =
        url.searchParams.get('sso_error') ||
        url.searchParams.get(`${provider}_error`) ||
        url.searchParams.get('error');
      if (err) throw new Error(err);
      const exchange = url.searchParams.get('exchange');
      if (!exchange) throw new Error('Missing exchange code from identity provider');
      await completeFederatedExchange(exchange);
    },
    [completeFederatedExchange],
  );

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
    () => ({ session, loading, signIn, signInWithProvider, completeFederatedExchange, signOut }),
    [session, loading, signIn, signInWithProvider, completeFederatedExchange, signOut],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider');
  return value;
}
