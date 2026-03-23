import { useState, useEffect, useCallback } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';

// ────────────────────────────────────────────────────────
// WAŻNE: Włącz Phone provider w Supabase Dashboard:
// Authentication → Providers → Phone → Enable
// Bez tego signInWithOtp nie zadziała.
// ────────────────────────────────────────────────────────

export interface AppUser {
  id: string;
  phone: string;
  name: string;
  role: 'senior' | 'caregiver';
  checkin_time: string | null;
}

export interface AuthState {
  session: Session | null;
  user: AppUser | null;
  hasActivePair: boolean;
  loading: boolean;
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [hasActivePair, setHasActivePair] = useState(false);
  const [loading, setLoading] = useState(true);

  // Pobierz profil z public.users + sprawdź care_pairs
  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (profile) {
        setUser({
          id: profile.id,
          phone: profile.phone,
          name: profile.name,
          role: profile.role,
          checkin_time: profile.checkin_time,
        });

        // Sprawdź aktywną parę
        const column = profile.role === 'senior' ? 'senior_id' : 'caregiver_id';
        const { data: pairs } = await supabase
          .from('care_pairs')
          .select('id')
          .eq(column, userId)
          .eq('status', 'active')
          .limit(1);

        setHasActivePair(!!(pairs && pairs.length > 0));
      } else {
        setUser(null);
        setHasActivePair(false);
      }
    } catch {
      setUser(null);
      setHasActivePair(false);
    }
  }, []);

  // Inicjalizacja — pobierz sesję
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s?.user) {
        fetchProfile(s.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, s) => {
        setSession(s);
        if (s?.user) {
          fetchProfile(s.user.id);
        } else {
          setUser(null);
          setHasActivePair(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  // ── Wyślij OTP na numer telefonu ──
  const signInWithPhone = async (phone: string) => {
    const { error } = await supabase.auth.signInWithOtp({ phone });
    if (error) throw new Error(error.message);
  };

  // ── Zweryfikuj kod OTP ──
  const verifyOtp = async (phone: string, code: string) => {
    const { data, error } = await supabase.auth.verifyOtp({
      phone,
      token: code,
      type: 'sms',
    });
    if (error) throw new Error(error.message);
    return data;
  };

  // ── Utwórz profil w public.users (po weryfikacji OTP) ──
  const createProfile = async (role: 'senior' | 'caregiver') => {
    const s = session || (await supabase.auth.getSession()).data.session;
    if (!s?.user) throw new Error('Brak sesji');

    const { error } = await supabase.from('users').insert({
      id: s.user.id,
      phone: s.user.phone || '',
      name: role === 'senior' ? 'Senior' : 'Bliski',
      role,
    });

    if (error && !error.message.includes('duplicate')) {
      throw new Error(error.message);
    }

    await fetchProfile(s.user.id);
  };

  // ── Wyloguj ──
  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setHasActivePair(false);
  };

  // ── Odśwież profil ──
  const refreshProfile = async () => {
    if (session?.user) {
      await fetchProfile(session.user.id);
    }
  };

  return {
    session,
    user,
    hasActivePair,
    loading,
    isAuthenticated: !!session,
    signInWithPhone,
    verifyOtp,
    createProfile,
    signOut,
    refreshProfile,
  };
}
