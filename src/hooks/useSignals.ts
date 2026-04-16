import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import type { Signal } from '../types';
import { todayMidnightISO } from '../utils/today';

export function useSignals() {
  const [todaySignals, setTodaySignals] = useState<Signal[]>([]);
  const [todaySentSignals, setTodaySentSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const fetchSignals = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setUserId(user.id);

      const todayStart = todayMidnightISO();

      // Incoming signals (to me today)
      const { data: incoming } = await supabase
        .from('signals')
        .select('*')
        .eq('to_user_id', user.id)
        .gte('created_at', todayStart)
        .order('created_at', { ascending: false });

      setTodaySignals(incoming || []);

      // Outgoing signals (from me today) — reactions + pokes
      const { data: outgoing } = await supabase
        .from('signals')
        .select('*')
        .eq('from_user_id', user.id)
        .in('type', ['reaction', 'poke'])
        .gte('created_at', todayStart)
        .order('created_at', { ascending: false });

      setTodaySentSignals(outgoing || []);
    } catch (err) {
      console.error('fetchSignals error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSignals(); }, [fetchSignals]);

  // Realtime: incoming signals
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`signals-in-${userId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'signals',
        filter: `to_user_id=eq.${userId}`,
      }, (payload) => {
        const sig = payload.new as Signal;
        if (sig.created_at >= todayMidnightISO()) {
          setTodaySignals(prev => prev.some(s => s.id === sig.id) ? prev : [sig, ...prev]);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  // Realtime: outgoing signals (to detect my own sends across devices)
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`signals-out-${userId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'signals',
        filter: `from_user_id=eq.${userId}`,
      }, (payload) => {
        const sig = payload.new as Signal;
        if ((sig.type === 'reaction' || sig.type === 'poke') && sig.created_at >= todayMidnightISO()) {
          setTodaySentSignals(prev => {
            const withoutOptimistic = prev.filter(s => !s.id.startsWith('optimistic-'));
            if (withoutOptimistic.some(s => s.id === sig.id)) return prev;
            return [sig, ...withoutOptimistic];
          });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  /** Send a signal. type defaults to 'reaction'. Returns false if duplicate for today was blocked. */
  const sendSignal = useCallback(async (toUserId: string, emoji: string, message?: string, signalType: string = 'reaction'): Promise<boolean> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Zaloguj się, żeby wysłać znak');

    // Dedup: block duplicate reactions and pokes per day
    if (signalType === 'reaction' || signalType === 'poke') {
      const { data: existing } = await supabase
        .from('signals')
        .select('id')
        .eq('from_user_id', user.id)
        .eq('to_user_id', toUserId)
        .eq('type', signalType)
        .gte('created_at', todayMidnightISO())
        .limit(1)
        .maybeSingle();

      if (existing) return false;
    }

    const { error } = await supabase.from('signals').insert({
      from_user_id: user.id,
      to_user_id: toUserId,
      type: signalType,
      emoji,
      message: message || null,
    });

    if (error) {
      // Postgres unique_violation from the per-day dedup indexes
      // (migrations 012 + 021). Treat as "already sent" rather than an error.
      const code = (error as { code?: string }).code;
      if (code === '23505' && (signalType === 'reaction' || signalType === 'poke')) {
        return false;
      }
      throw error;
    }

    // Push notifications (fire-and-forget)
    if (signalType === 'reaction') {
      supabase.functions.invoke('reaction-notify', {
        body: { to_user_id: toUserId, emoji },
      }).catch(() => {});
    } else if (signalType === 'poke') {
      supabase.functions.invoke('poke-notify', {
        body: { to_user_id: toUserId, emoji },
      }).catch(() => {});
    }

    // Optimistic update for reactions and pokes
    if (signalType === 'reaction' || signalType === 'poke') {
      const optimisticId = `optimistic-${signalType}-${toUserId}-${Date.now()}`;
      setTodaySentSignals(prev => [{
        id: optimisticId,
        from_user_id: user.id,
        to_user_id: toUserId,
        type: signalType as Signal['type'],
        emoji,
        message: message || null,
        created_at: new Date().toISOString(),
        seen_at: null,
      }, ...prev]);
    }

    return true;
  }, []);

  /** Check if current user already sent a reaction to someone today */
  const hasSentReactionToday = useCallback((toUserId: string): boolean => {
    return todaySentSignals.some((s) => s.to_user_id === toUserId && s.type === 'reaction');
  }, [todaySentSignals]);

  /** Check if current user already sent a poke to someone today */
  const hasSentPokeToday = useCallback((toUserId: string): boolean => {
    return todaySentSignals.some((s) => s.to_user_id === toUserId && s.type === 'poke');
  }, [todaySentSignals]);

  return {
    todaySignals,
    todaySentSignals,
    sendSignal,
    hasSentReactionToday,
    hasSentPokeToday,
    loading,
    refresh: fetchSignals,
  };
}
