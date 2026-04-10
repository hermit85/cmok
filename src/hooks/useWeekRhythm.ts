/**
 * useWeekRhythm — returns 7 day statuses for the WeekDots component
 * AND the current check-in streak (consecutive days, up to 31 days back).
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { todayDateKey } from '../utils/today';

export type DayStatus = 'ok' | 'missing' | 'future';

export function useWeekRhythm(signalerId: string | null) {
  const [days, setDays] = useState<DayStatus[]>([]);
  const [monthDays, setMonthDays] = useState<DayStatus[]>([]);
  const [streak, setStreak] = useState(0);
  const [totalCheckins, setTotalCheckins] = useState(0);

  const refresh = useCallback(async () => {
    if (!signalerId) { setDays([]); setMonthDays([]); setStreak(0); setTotalCheckins(0); return; }

    try {
      const today = new Date();
      const ago31 = new Date(today);
      ago31.setDate(today.getDate() - 30);

      const { data } = await supabase
        .from('daily_checkins')
        .select('local_date')
        .eq('senior_id', signalerId)
        .gte('local_date', todayDateKey(ago31))
        .lte('local_date', todayDateKey(today));

      const dates = new Set((data || []).map((r: { local_date: string }) => r.local_date));
      const todayStr = todayDateKey(today);

      // 7-day dots (same as before)
      const week: DayStatus[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const ds = todayDateKey(d);
        week.push(dates.has(ds) ? 'ok' : ds === todayStr ? 'future' : 'missing');
      }

      // 31-day grid (for month view)
      const month: DayStatus[] = [];
      for (let i = 30; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const ds = todayDateKey(d);
        month.push(dates.has(ds) ? 'ok' : ds === todayStr ? 'future' : 'missing');
      }

      // Streak: consecutive days from today backward (up to 31 days)
      let s = 0;
      for (let i = 0; i <= 30; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const ds = todayDateKey(d);
        if (dates.has(ds)) {
          s++;
        } else if (ds === todayStr) {
          // Today with no checkin yet — skip, don't break streak
          continue;
        } else {
          break;
        }
      }

      setDays(week);
      setMonthDays(month);
      setStreak(s);
      setTotalCheckins(dates.size);
    } catch (err) {
      console.error('[useWeekRhythm] error:', err);
      setDays([]);
      setMonthDays([]);
      setStreak(0);
      setTotalCheckins(0);
    }
  }, [signalerId]);

  useEffect(() => { refresh(); }, [refresh]);

  return { days, monthDays, streak, totalCheckins, refresh };
}
