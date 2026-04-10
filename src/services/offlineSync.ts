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
 * Only syncs if the pending item is for TODAY's local date.
 * Stale items (from previous days) are discarded without syncing.
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

    await removeItem(PENDING_CHECKIN_KEY);
    return true;
  } catch (err) {
    console.error('syncPendingCheckin error:', err);
    return false;
  }
}

/** Check if there's a pending check-in. */
export async function hasPendingCheckin(): Promise<boolean> {
  const raw = await getItem(PENDING_CHECKIN_KEY);
  return !!raw;
}
