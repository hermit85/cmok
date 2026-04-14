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
      if (!user) return;
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

      // Outgoing signals (from me today) — to check if I already responded
      const { data: outgoing } = await supabase
        .from('signals')
        .select('*')
        .eq('from_user_id', user.id)
        .eq('type', 'reaction')
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
        if (sig.type === 'reaction' && sig.created_at >= todayMidnightISO()) {
          setTodaySentSignals(prev => prev.some(s => s.id === sig.id) ? prev : [sig, ...prev]);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  /** Send a signal. type defaults to 'reaction'. Returns false if duplicate reaction for today was blocked. */
  const sendSignal = useCallback(async (toUserId: string, emoji: string, message?: string, signalType: string = 'reaction'): Promise<boolean> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Brak zalogowanego użytkownika');

    // Dedup: only block duplicate reactions (not morning thoughts etc.)
    if (signalType === 'reaction') {
      const { data: existing } = await supabase
        .from('signals')
        .select('id')
        .eq('from_user_id', user.id)
        .eq('to_user_id', toUserId)
        .eq('type', 'reaction')
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

    if (error) throw error;

    // Optimistic update (only track reactions for hasSentReactionToday)
    if (signalType === 'reaction') {
      setTodaySentSignals(prev => [{
        id: 'optimistic',
        from_user_id: user.id,
        to_user_id: toUserId,
        type: 'reaction',
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
    return todaySentSignals.some((s) => s.to_user_id === toUserId);
  }, [todaySentSignals]);

  return {
    todaySignals,
    todaySentSignals,
    sendSignal,
    hasSentReactionToday,
    loading,
    refresh: fetchSignals,
  };
}
