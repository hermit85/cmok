import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { supabase } from './supabase';
import { formatLocalDateKey } from '../utils/date';

const PENDING_CHECKIN_KEY = 'cmok_pending_checkin';

interface PendingCheckin {
  senior_id: string;
  local_date: string;
  source: 'app';
}

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function removeItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

/** Zapisz pending check-in lokalnie (gdy offline) */
export async function savePendingCheckin(seniorId: string): Promise<void> {
  const checkin: PendingCheckin = {
    senior_id: seniorId,
    local_date: formatLocalDateKey(),
    source: 'app',
  };
  await setItem(PENDING_CHECKIN_KEY, JSON.stringify(checkin));
}

/** Sprawdź czy jest pending check-in i wyślij do Supabase */
export async function syncPendingCheckin(): Promise<boolean> {
  try {
    const raw = await getItem(PENDING_CHECKIN_KEY);
    if (!raw) return false;

    const checkin: PendingCheckin = JSON.parse(raw);

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

/** Czy jest pending check-in? */
export async function hasPendingCheckin(): Promise<boolean> {
  const raw = await getItem(PENDING_CHECKIN_KEY);
  return !!raw;
}
