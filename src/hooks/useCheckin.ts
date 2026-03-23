import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import type { DailyCheckin } from '../types';

export function useCheckin() {
  const [checkedInToday, setCheckedInToday] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastCheckin, setLastCheckin] = useState<{ checked_at: string; source: string } | null>(null);

  const getTodayDate = () => new Date().toISOString().split('T')[0];

  const refreshCheckin = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const today = getTodayDate();

      const { data, error } = await supabase
        .from('daily_checkins')
        .select('*')
        .eq('senior_id', user.id)
        .eq('local_date', today)
        .limit(1)
        .single();

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
  }, []);

  const performCheckin = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Brak zalogowanego użytkownika');

      const today = getTodayDate();

      const { error } = await supabase
        .from('daily_checkins')
        .upsert(
          {
            senior_id: user.id,
            local_date: today,
            source: 'app',
          },
          { onConflict: 'senior_id,local_date' }
        );

      if (error) throw error;

      setCheckedInToday(true);
      setLastCheckin({ checked_at: new Date().toISOString(), source: 'app' });
    } catch (err) {
      console.error('performCheckin error:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Sprawdź stan przy mount
  useEffect(() => {
    refreshCheckin();
  }, [refreshCheckin]);

  return {
    checkedInToday,
    loading,
    lastCheckin,
    performCheckin,
    refreshCheckin,
  };
}
