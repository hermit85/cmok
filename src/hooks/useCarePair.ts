import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import type { CarePair } from '../types';

export function useCarePair() {
  const [carePair, setCarePair] = useState<CarePair | null>(null);
  const [seniorName, setSeniorName] = useState('');
  const [seniorId, setSeniorId] = useState<string | null>(null);
  const [callPhone, setCallPhone] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchCarePair = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Pobierz profil użytkownika żeby znać rolę
      const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

      if (!profile) return;

      const column = profile.role === 'senior' ? 'senior_id' : 'caregiver_id';

      const { data: pair } = await supabase
        .from('care_pairs')
        .select('*')
        .eq(column, user.id)
        .eq('status', 'active')
        .order('priority', { ascending: true })
        .limit(1)
        .single();

      if (!pair) return;

      setCarePair(pair);
      setCallPhone(pair.sms_fallback_phone || '');

      // Pobierz imię drugiej osoby z pary
      const otherId = profile.role === 'caregiver' ? pair.senior_id : pair.caregiver_id;
      setSeniorId(profile.role === 'caregiver' ? pair.senior_id : null);

      const { data: otherUser } = await supabase
        .from('users')
        .select('name')
        .eq('id', otherId)
        .single();

      setSeniorName(otherUser?.name || 'Bliski');
    } catch (err) {
      console.error('fetchCarePair error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCarePair();
  }, [fetchCarePair]);

  return {
    carePair,
    seniorName,
    seniorId,
    callPhone,
    loading,
    refreshCarePair: fetchCarePair,
  };
}
