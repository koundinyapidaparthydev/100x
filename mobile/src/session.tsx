import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { AuthSession, FederatedAuthProvider } from '@shared/types';
import { api, setSessionToken } from './api';

WebBrowser.maybeCompleteAuthSession();

const SESSION_KEY = 'aplifyai.mobile.session';
const MOBILE_REDIRECT = 'aplifyai://auth/callback';

/** Dedupes concurrent exchange attempts from openAuthSessionAsync + deep-link route. */
const exchangeInflight = new Map<string, Promise<AuthSession>>();

interface SessionContextValue {
  session: AuthSession | null;
  loading: boolean;
  signIn: (identity?: string) => Promise<void>;
  signInWithProvider: (provider: FederatedAuthProvider) => Promise<void>;
  completeFederatedExchange: (exchange: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

function parseAuthParams(url: string): {
  exchange: string | null;
  error: string | null;
  provider: string | null;
} {
  const parsed = Linking.parse(url);
  const q = parsed.queryParams ?? {};
  const str = (key: string) => {
    const value = q[key];
    if (typeof value === 'string') return value;
    if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
    return null;
  };
  const provider = str('provider');
  const error =
    str('sso_error') ||
    str('error') ||
    (provider ? str(`${provider}_error`) : null) ||
    str('google_error') ||
    str('apple_error') ||
    str('okta_error') ||
    str('entra_error') ||
    str('google_workspace_error');
  return { exchange: str('exchange'), error, provider };
}

function applySession(next: AuthSession | null) {
  setSessionToken(next?.token ?? null);
}

async function persistSession(next: AuthSession) {
  applySession(next);
  const payload = JSON.stringify(next);
  try {
    await SecureStore.setItemAsync(SESSION_KEY, payload);
    // Prefer SecureStore as source of truth; drop any prior AsyncStorage copy.
    await AsyncStorage.removeItem(SESSION_KEY).catch(() => undefined);
  } catch {
    // Unsigned Detox/sim builds often lack keychain entitlements. Fall back so
    // reopen still restores the session; keep in-memory token either way.
    await AsyncStorage.setItem(SESSION_KEY, payload);
  }
}

async function readStoredSession(): Promise<string | null> {
  try {
    const fromSecure = await SecureStore.getItemAsync(SESSION_KEY);
    if (fromSecure) return fromSecure;
  } catch {
    // Keychain unavailable — try AsyncStorage.
  }
  return AsyncStorage.getItem(SESSION_KEY);
}

async function clearStoredSession() {
  await Promise.all([
    SecureStore.deleteItemAsync(SESSION_KEY).catch(() => undefined),
    AsyncStorage.removeItem(SESSION_KEY).catch(() => undefined),
  ]);
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);
  const sessionRef = useRef<AuthSession | null>(null);
  sessionRef.current = session;

  useEffect(() => {
    void readStoredSession()
      .then((raw) => {
        if (!raw) return;
        const saved = JSON.parse(raw) as AuthSession;
        if (new Date(saved.expiresAt).getTime() <= Date.now()) {
          void clearStoredSession();
          return;
        }
        applySession(saved);
        setSession(saved);
      })
      .catch(() => {
        void clearStoredSession();
      })
      .finally(() => setLoading(false));
  }, []);

  const completeFederatedExchange = useCallback(async (exchange: string) => {
    let pending = exchangeInflight.get(exchange);
    if (!pending) {
      pending = api.federatedExchange(exchange).then(async (result) => {
        await persistSession(result.session);
        setSession(result.session);
        return result.session;
      });
      exchangeInflight.set(exchange, pending);
      pending.catch(() => {
        exchangeInflight.delete(exchange);
      });
    }
    await pending;
  }, []);

  const signIn = useCallback(async (identity = 'manager') => {
    const result = await api.login(identity);
    await persistSession(result.session);
    setSession(result.session);
  }, []);

  const signInWithProvider = useCallback(
    async (provider: FederatedAuthProvider) => {
      const startUrl = api.authStartUrl(provider, 'login');
      const result = await WebBrowser.openAuthSessionAsync(startUrl, MOBILE_REDIRECT);

      if (result.type === 'success' && result.url) {
        const { exchange, error } = parseAuthParams(result.url);
        if (error) throw new Error(error);
        if (!exchange) throw new Error('Missing exchange code from identity provider');
        await completeFederatedExchange(exchange);
        return;
      }

      // iOS often dismisses ASWebAuthenticationSession while Expo Router still
      // opens aplifyai://auth/callback. Wait briefly for that path to finish.
      if (result.type === 'cancel' || result.type === 'dismiss') {
        for (let attempt = 0; attempt < 12; attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, 250));
          if (sessionRef.current) return;
        }
        throw new Error('Sign-in cancelled');
      }

      throw new Error('Sign-in did not complete');
    },
    [completeFederatedExchange],
  );

  const signOut = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      applySession(null);
      setSession(null);
      await clearStoredSession();
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

export { exchangeInflight, parseAuthParams, SESSION_KEY, clearStoredSession };
