/**
 * useCheckinStats — streak length and total check-in count for the signaler.
 * Used for contextual confirmation messages after daily sign.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { todayDateKey } from '../utils/today';

export function useCheckinStats(signalerId: string | null) {
  const [streak, setStreak] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!signalerId) { setStreak(0); setTotalCount(0); return; }

    try {
      const today = new Date();
      const ago = new Date(today);
      ago.setDate(today.getDate() - 30);

      const [streakResult, countResult] = await Promise.all([
        // Last 31 days for streak computation
        supabase
          .from('daily_checkins')
          .select('local_date')
          .eq('senior_id', signalerId)
          .gte('local_date', todayDateKey(ago))
          .lte('local_date', todayDateKey(today))
          .order('local_date', { ascending: false }),
        // Total count (all-time)
        supabase
          .from('daily_checkins')
          .select('*', { count: 'exact', head: true })
          .eq('senior_id', signalerId),
      ]);

      // Compute streak: consecutive ok days from today backwards
      const dates = new Set(
        (streakResult.data || []).map((r: { local_date: string }) => r.local_date),
      );
      const todayStr = todayDateKey(today);
      let s = 0;
      for (let i = 0; i <= 30; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const ds = todayDateKey(d);
        if (dates.has(ds)) {
          s++;
        } else if (ds === todayStr) {
          // Today not yet checked in — skip, don't break
          continue;
        } else {
          break;
        }
      }

      setStreak(s);
      setTotalCount(countResult.count ?? 0);
    } catch (err) {
      console.error('[useCheckinStats] error:', err);
    }
  }, [signalerId]);

  useEffect(() => { refresh(); }, [refresh]);

  return { streak, totalCount, refresh };
}
