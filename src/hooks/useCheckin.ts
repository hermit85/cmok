import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../services/supabase';
import { todayDateKey } from '../utils/today';

export function useCheckin() {
  const [checkedInToday, setCheckedInToday] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastCheckin, setLastCheckin] = useState<{ checked_at: string; source: string } | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Debounce: prevent multiple rapid refreshes from auth state changes
  const lastRefreshTime = useRef(0);
  const REFRESH_DEBOUNCE_MS = 3000;

  const syncCurrentUser = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setCurrentUserId(session?.user?.id ?? null);
    setAuthReady(true);
    return session?.user?.id ?? null;
  }, []);

  const refreshCheckin = useCallback(async () => {
    // Debounce: don't re-fetch if we just fetched
    const now = Date.now();
    if (now - lastRefreshTime.current < REFRESH_DEBOUNCE_MS) return;
    lastRefreshTime.current = now;

    try {
      const userId = currentUserId ?? (await syncCurrentUser());
      if (!userId) {
        setCheckedInToday(false);
        setLastCheckin(null);
        return;
      }

      const today = todayDateKey();

      const { data, error } = await supabase
        .from('daily_checkins')
        .select('checked_at, source, local_date')
        .eq('senior_id', userId)
        .eq('local_date', today)
        .limit(1)
        .maybeSingle();

      if (data && !error && data.local_date === today) {
        setCheckedInToday(true);
        setLastCheckin({ checked_at: data.checked_at, source: data.source });
      } else {
        setCheckedInToday(false);
        setLastCheckin(null);
      }
    } catch (err) {
      console.error('refreshCheckin error:', err);
    }
  }, [currentUserId, syncCurrentUser]);

  const performCheckin = useCallback(async () => {
    setLoading(true);
    try {
      const userId = currentUserId ?? (await syncCurrentUser());
      if (!userId) {
        const error = new Error('Brak zalogowanego użytkownika');
        error.name = 'AUTH_REQUIRED';
        throw error;
      }

      const today = todayDateKey();

      const { error } = await supabase
        .from('daily_checkins')
        .upsert(
          { senior_id: userId, local_date: today, source: 'app' },
          { onConflict: 'senior_id,local_date' },
        );

      if (error) throw error;

      // Notify recipient (fire-and-forget, never blocks check-in)
      supabase.functions.invoke('checkin-notify', { body: {} }).catch(() => {});

      setCheckedInToday(true);
      setLastCheckin({ checked_at: new Date().toISOString(), source: 'app' });
      lastRefreshTime.current = Date.now(); // Prevent immediate re-fetch
    } catch (err) {
      console.error('performCheckin error:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [currentUserId, syncCurrentUser]);

  // Initial load
  useEffect(() => {
    syncCurrentUser().then((userId) => {
      if (userId) refreshCheckin();
      else { setCheckedInToday(false); setLastCheckin(null); }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUserId = session?.user?.id ?? null;
      setCurrentUserId(nextUserId);
      setAuthReady(true);

      if (nextUserId) {
        // Debounced — won't re-fetch if we just did
        refreshCheckin();
      } else {
        setCheckedInToday(false);
        setLastCheckin(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [refreshCheckin, syncCurrentUser]);

  return {
    authReady,
    isAuthenticated: Boolean(currentUserId),
    userId: currentUserId,
    checkedInToday,
    loading,
    lastCheckin,
    performCheckin,
    refreshCheckin,
  };
}
