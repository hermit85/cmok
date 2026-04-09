import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { formatLocalDateKey } from '../utils/date';

export function useCheckin() {
  const [checkedInToday, setCheckedInToday] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastCheckin, setLastCheckin] = useState<{ checked_at: string; source: string } | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const syncCurrentUser = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    setCurrentUserId(session?.user?.id ?? null);
    setAuthReady(true);

    return session?.user?.id ?? null;
  }, []);

  const refreshCheckin = useCallback(async () => {
    try {
      const userId = currentUserId ?? (await syncCurrentUser());
      if (!userId) {
        setCheckedInToday(false);
        setLastCheckin(null);
        return;
      }

      const today = formatLocalDateKey();

      const { data, error } = await supabase
        .from('daily_checkins')
        .select('*')
        .eq('senior_id', userId)
        .eq('local_date', today)
        .limit(1)
        .maybeSingle();

      if (data && !error) {
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

      const today = formatLocalDateKey();

      const { error } = await supabase
        .from('daily_checkins')
        .upsert(
          {
            senior_id: userId,
            local_date: today,
            source: 'app',
          },
          { onConflict: 'senior_id,local_date' }
        );

      if (error) throw error;

      // TODO: PUSH — notify the recipient that today's signal was sent
      setCheckedInToday(true);
      setLastCheckin({ checked_at: new Date().toISOString(), source: 'app' });
    } catch (err) {
      console.error('performCheckin error:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [currentUserId, syncCurrentUser]);

  useEffect(() => {
    syncCurrentUser().then((userId) => {
      if (userId) {
        refreshCheckin();
      } else {
        setCheckedInToday(false);
        setLastCheckin(null);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUserId = session?.user?.id ?? null;
      setCurrentUserId(nextUserId);
      setAuthReady(true);

      if (nextUserId) {
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
