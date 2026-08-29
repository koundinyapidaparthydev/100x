import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

export const ONBOARDING_SEEN_KEY = '100x.mobile.onboarding.seen';

async function writeFlag(value: string) {
  try {
    await SecureStore.setItemAsync(ONBOARDING_SEEN_KEY, value);
    await AsyncStorage.removeItem(ONBOARDING_SEEN_KEY).catch(() => undefined);
  } catch {
    await AsyncStorage.setItem(ONBOARDING_SEEN_KEY, value);
  }
}

async function readFlag(): Promise<string | null> {
  try {
    const fromSecure = await SecureStore.getItemAsync(ONBOARDING_SEEN_KEY);
    if (fromSecure) return fromSecure;
  } catch {
    // Keychain unavailable — try AsyncStorage.
  }
  return AsyncStorage.getItem(ONBOARDING_SEEN_KEY);
}

export async function hasSeenOnboarding(): Promise<boolean> {
  const raw = await readFlag();
  return raw === '1';
}

export async function markOnboardingSeen(): Promise<void> {
  await writeFlag('1');
}

export async function clearOnboardingSeen(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ONBOARDING_SEEN_KEY).catch(() => undefined),
    AsyncStorage.removeItem(ONBOARDING_SEEN_KEY).catch(() => undefined),
  ]);
}
