import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const KEY = 'cmok_pending_invite';

interface PendingInvite {
  code: string;
  source: 'deep-link' | 'manual';
  savedAt: string;
}

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') return localStorage.getItem(key);
  return SecureStore.getItemAsync(key);
}

async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') { localStorage.setItem(key, value); return; }
  await SecureStore.setItemAsync(key, value);
}

async function removeItem(key: string): Promise<void> {
  if (Platform.OS === 'web') { localStorage.removeItem(key); return; }
  await SecureStore.deleteItemAsync(key);
}

/** Save an invite code for later resume after auth. */
export async function savePendingInvite(code: string, source: 'deep-link' | 'manual'): Promise<void> {
  const data: PendingInvite = { code, source, savedAt: new Date().toISOString() };
  await setItem(KEY, JSON.stringify(data));
}

/** Get pending invite code, or null if none / expired (>24h). */
export async function getPendingInvite(): Promise<PendingInvite | null> {
  try {
    const raw = await getItem(KEY);
    if (!raw) return null;
    const data: PendingInvite = JSON.parse(raw);
    // Expire after 24 hours
    const age = Date.now() - new Date(data.savedAt).getTime();
    if (age > 24 * 60 * 60 * 1000) {
      await removeItem(KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

/** Clear pending invite (after successful join or manual dismiss). */
export async function clearPendingInvite(): Promise<void> {
  await removeItem(KEY);
}
