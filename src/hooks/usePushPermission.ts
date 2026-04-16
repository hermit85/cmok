import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

type PermissionStatus = 'granted' | 'denied' | 'undetermined' | 'unsupported';

/**
 * Tracks push-notification permission status so home screens can surface
 * a gentle banner when the user has silently denied notifications. Without
 * this, check-ins and urgent signals never reach the other side but nobody
 * knows why.
 *
 * Updates on mount and whenever the app returns to foreground (user may
 * have toggled the system setting while away).
 */
export function usePushPermission() {
  const [status, setStatus] = useState<PermissionStatus>('undetermined');

  const refresh = useCallback(async () => {
    if (Platform.OS === 'web') { setStatus('unsupported'); return; }
    try {
      const res = await Notifications.getPermissionsAsync();
      if (res.status === 'granted') setStatus('granted');
      else if (res.status === 'denied') setStatus('denied');
      else setStatus('undetermined');
    } catch {
      setStatus('undetermined');
    }
  }, []);

  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const openSettings = useCallback(async () => {
    try {
      await Linking.openSettings();
    } catch {
      // no-op — most platforms always succeed
    }
  }, []);

  return { status, refresh, openSettings };
}
