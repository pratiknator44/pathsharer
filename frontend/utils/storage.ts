/**
 * Unified storage utility for PathSharer
 *
 * Use SecureStore for sensitive values (JWT, auth tokens, user IDs).
 * SecureStore uses iOS Keychain / Android Keystore under the hood.
 *
 * Limit: ~2KB per value. For larger data (trip cache, location history)
 * use expo-sqlite when needed.
 */
import * as SecureStore from 'expo-secure-store';

// ---------- Keys ----------
export const StorageKeys = {
  AUTH_TOKEN: 'auth_token',
  REFRESH_TOKEN: 'refresh_token',
  USER_ID: 'user_id',
} as const;

// ---------- Helpers ----------

export async function secureSet(key: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(key, value);
}

export async function secureGet(key: string): Promise<string | null> {
  return SecureStore.getItemAsync(key);
}

export async function secureRemove(key: string): Promise<void> {
  await SecureStore.deleteItemAsync(key);
}

// ---------- Auth shortcuts ----------

export async function saveAuthToken(token: string): Promise<void> {
  await secureSet(StorageKeys.AUTH_TOKEN, token);
}

export async function getAuthToken(): Promise<string | null> {
  return secureGet(StorageKeys.AUTH_TOKEN);
}

export async function clearAuthTokens(): Promise<void> {
  await Promise.all([
    secureRemove(StorageKeys.AUTH_TOKEN),
    secureRemove(StorageKeys.REFRESH_TOKEN),
    secureRemove(StorageKeys.USER_ID),
  ]);
}
