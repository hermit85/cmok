/**
 * useWeekRhythm — returns 7 day statuses for the current calendar week (Mon→Sun).
 * Queries daily_checkins for the current week for a given signaler userId.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { todayDateKey } from '../utils/today';

export type DayStatus = 'ok' | 'missing' | 'future';

/** Get Monday of the current week (Polish standard: week starts on Monday). */
function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const diff = day === 0 ? -6 : 1 - day; // if Sun, go back 6 days
  date.setDate(date.getDate() + diff);
  return date;
}

export function useWeekRhythm(signalerId: string | null) {
  const [days, setDays] = useState<DayStatus[]>([]);

  const refresh = useCallback(async () => {
    if (!signalerId) { setDays([]); return; }

    try {
      const today = new Date();
      const monday = getMonday(today);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);

      const { data } = await supabase
        .from('daily_checkins')
        .select('local_date')
        .eq('senior_id', signalerId)
        .gte('local_date', todayDateKey(monday))
        .lte('local_date', todayDateKey(sunday));

      const dates = new Set((data || []).map((r: { local_date: string }) => r.local_date));
      const todayStr = todayDateKey(today);
      const week: DayStatus[] = [];

      for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const ds = todayDateKey(d);
        if (dates.has(ds)) {
          week.push('ok');
        } else if (ds > todayStr) {
          week.push('future');
        } else if (ds === todayStr) {
          week.push('future'); // today, not yet checked in
        } else {
          week.push('missing');
        }
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
