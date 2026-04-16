import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { supabase } from './supabase';
import { todayDateKey } from '../utils/today';

const PENDING_CHECKIN_KEY = 'cmok_pending_checkin';

interface PendingCheckin {
  senior_id: string;
  local_date: string;
  source: 'app';
  /** Timestamp when the user tapped. Used for staleness check. */
  saved_at?: string;
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

/** Save pending check-in locally (when offline). Includes timestamp for validation. */
export async function savePendingCheckin(seniorId: string): Promise<void> {
  const checkin: PendingCheckin = {
    senior_id: seniorId,
    local_date: todayDateKey(),
    source: 'app',
    saved_at: new Date().toISOString(),
  };
  await setItem(PENDING_CHECKIN_KEY, JSON.stringify(checkin));
}

/**
 * Sync pending check-in to Supabase.
 * Only syncs if:
 *   - the pending item is for TODAY's local date, AND
 *   - the stored senior_id matches the currently authenticated user.
 * Stale / cross-user items are discarded without syncing.
 */
export async function syncPendingCheckin(): Promise<boolean> {
  try {
    const raw = await getItem(PENDING_CHECKIN_KEY);
    if (!raw) return false;

    const checkin: PendingCheckin = JSON.parse(raw);
    const today = todayDateKey();

    // SAFETY: reject stale pending items from previous days
    if (checkin.local_date !== today) {
      console.log('[offlineSync] discarding stale pending from', checkin.local_date, '(today is', today, ')');
      await removeItem(PENDING_CHECKIN_KEY);
      return false;
    }

    // SAFETY: reject pending items that don't belong to the current auth user.
    // Prevents a previous user's offline tap from materialising as a checkin
    // for a new account on the same device (which looked to the recipient
    // like a sign appearing out of nowhere).
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || checkin.senior_id !== user.id) {
      console.log('[offlineSync] discarding pending — senior_id does not match current user');
      await removeItem(PENDING_CHECKIN_KEY);
      return false;
    }

    const { error } = await supabase
      .from('daily_checkins')
      .upsert(
        {
          senior_id: checkin.senior_id,
          local_date: checkin.local_date,
          source: checkin.source,
        },
        { onConflict: 'senior_id,local_date' }
      );

    if (error) throw error;

    // Remove pending BEFORE notify — prevents duplicate push if app crashes between
    await removeItem(PENDING_CHECKIN_KEY);

    // Notify recipient now that the offline check-in reached the server
    supabase.functions.invoke('checkin-notify', { body: {} }).catch(() => {});
    return true;
  } catch (err) {
    console.error('syncPendingCheckin error:', err);
    return false;
  }
}

/**
 * Clear any locally cached offline state that is tied to a user session.
 * Call this from sign-out paths so a new user on the same device never
 * inherits a previous user's pending tap.
 */
export async function clearPendingCheckin(): Promise<void> {
  await removeItem(PENDING_CHECKIN_KEY);
}

/** Check if there's a pending check-in. */
export async function hasPendingCheckin(): Promise<boolean> {
  const raw = await getItem(PENDING_CHECKIN_KEY);
  return !!raw;
}
