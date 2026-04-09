/**
 * useWeekRhythm — returns 7 day statuses for the WeekDots component.
 * Queries last 7 days of daily_checkins for a given signaler userId.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { formatLocalDateKey } from '../utils/date';

export type DayStatus = 'ok' | 'missing' | 'future';

export function useWeekRhythm(signalerId: string | null) {
  const [days, setDays] = useState<DayStatus[]>([]);

  const refresh = useCallback(async () => {
    if (!signalerId) { setDays([]); return; }

    try {
      const today = new Date();
      const ago = new Date(today);
      ago.setDate(today.getDate() - 6);

      const { data } = await supabase
        .from('daily_checkins')
        .select('local_date')
        .eq('senior_id', signalerId)
        .gte('local_date', formatLocalDateKey(ago))
        .lte('local_date', formatLocalDateKey(today));

      const dates = new Set((data || []).map((r: { local_date: string }) => r.local_date));
      const todayStr = formatLocalDateKey(today);
      const week: DayStatus[] = [];

      for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const ds = formatLocalDateKey(d);
        week.push(dates.has(ds) ? 'ok' : ds === todayStr ? 'future' : 'missing');
      }

      setDays(week);
    } catch (err) {
      console.error('[useWeekRhythm] error:', err);
      setDays([]);
    }
  }, [signalerId]);

  useEffect(() => { refresh(); }, [refresh]);

  return { days, refresh };
}
