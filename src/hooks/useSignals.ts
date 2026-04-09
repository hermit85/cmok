import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import type { Signal } from '../types';

function getTodayStart(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function useSignals() {
  const [todaySignals, setTodaySignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  // Fetch sygnały z dzisiaj
  const fetchSignals = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data } = await supabase
        .from('signals')
        .select('*')
        .eq('to_user_id', user.id)
        .gte('created_at', getTodayStart())
        .order('created_at', { ascending: false });

      setTodaySignals(data || []);
    } catch (err) {
      console.error('fetchSignals error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSignals();
  }, [fetchSignals]);

  // Realtime subscription
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`signals-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'signals',
          filter: `to_user_id=eq.${userId}`,
        },
        (payload) => {
          const newSignal = payload.new as Signal;
          setTodaySignals(prev => [newSignal, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // Wyślij sygnał
  const sendSignal = useCallback(async (toUserId: string, emoji: string, message?: string) => {
    // TODO: PUSH — notify signal recipient
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Brak zalogowanego użytkownika');

    const { error } = await supabase.from('signals').insert({
      from_user_id: user.id,
      to_user_id: toUserId,
      type: 'reaction',
      emoji,
      message: message || null,
    });

    if (error) throw error;
  }, []);

  return {
    todaySignals,
    sendSignal,
    loading,
  };
}
