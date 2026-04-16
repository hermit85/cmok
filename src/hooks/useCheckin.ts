import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../services/supabase';
import { todayDateKey } from '../utils/today';

function isAuthError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { status?: number; code?: string; message?: string };
  if (e.status === 401) return true;
  if (e.code === 'PGRST301' || e.code === '401') return true;
  const msg = (e.message || '').toLowerCase();
  return msg.includes('jwt') || msg.includes('token') || msg.includes('expired') || msg.includes('unauthor');
}

export function useCheckin() {
  const [checkedInToday, setCheckedInToday] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastCheckin, setLastCheckin] = useState<{ checked_at: string; source: string } | null>(null);
  const [statusEmoji, setStatusEmoji] = useState<string | null>(null);
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
        .select('checked_at, source, local_date, status_emoji')
        .eq('senior_id', userId)
        .eq('local_date', today)
        .limit(1)
        .maybeSingle();

      if (data && !error && data.local_date === today) {
        setCheckedInToday(true);
        setLastCheckin({ checked_at: data.checked_at, source: data.source });
        setStatusEmoji((data as Record<string, unknown>).status_emoji as string | null ?? null);
      } else {
        setCheckedInToday(false);
        setLastCheckin(null);
        setStatusEmoji(null);
      }
    } catch (err) {
      console.error('refreshCheckin error:', err);
    }
  }, [currentUserId, syncCurrentUser]);

  const performCheckin = useCallback(async () => {
    setLoading(true);
    try {
      let userId = currentUserId ?? (await syncCurrentUser());
      if (!userId) {
        const error = new Error('Brak zalogowanego użytkownika');
        error.name = 'AUTH_REQUIRED';
        throw error;
      }

      const today = todayDateKey();

      const attemptUpsert = () =>
        supabase
          .from('daily_checkins')
          .upsert(
            { senior_id: userId, local_date: today, source: 'app' },
            { onConflict: 'senior_id,local_date' },
          );

      let { error } = await attemptUpsert();

      // Stale JWT: attempt refresh + retry once before surfacing the error.
      if (error && isAuthError(error)) {
        const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
        if (refreshErr || !refreshed.session) {
          const authErr = new Error('Brak zalogowanego użytkownika');
          authErr.name = 'AUTH_REQUIRED';
          throw authErr;
        }
        userId = refreshed.session.user.id;
        setCurrentUserId(userId);
        ({ error } = await attemptUpsert());
      }

      if (error) throw error;

      // Notify recipient (fire-and-forget, never blocks check-in)
      supabase.functions.invoke('checkin-notify', { body: {} }).catch(() => {});

      setCheckedInToday(true);
      setLastCheckin({ checked_at: new Date().toISOString(), source: 'app' });
      setStatusEmoji(null); // fresh checkin, no status yet
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
    statusEmoji,
    performCheckin,
    refreshCheckin,
  };
}
