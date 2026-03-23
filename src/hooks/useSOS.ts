import { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import { supabase } from '../services/supabase';
import type { AlertCase } from '../types';

export function useSOS() {
  const [sosActive, setSosActive] = useState(false);
  const [currentAlert, setCurrentAlert] = useState<AlertCase | null>(null);
  const [loading, setLoading] = useState(false);

  // ── Sprawdź otwarty alert przy mount ──
  const checkActiveAlert = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('alert_cases')
        .select('*')
        .eq('senior_id', user.id)
        .eq('type', 'sos')
        .in('state', ['open', 'acknowledged'])
        .order('triggered_at', { ascending: false })
        .limit(1)
        .single();

      if (data) {
        setSosActive(true);
        setCurrentAlert(data);
      }
    } catch {
      // Brak aktywnego alertu — OK
    }
  }, []);

  useEffect(() => {
    checkActiveAlert();
  }, [checkActiveAlert]);

  // ── Pobierz lokalizację GPS (timeout 5s) ──
  const getLocation = async (): Promise<{ latitude: number; longitude: number } | null> => {
    try {
      if (Platform.OS === 'web') {
        // Web: navigator.geolocation
        return new Promise((resolve) => {
          const timer = setTimeout(() => resolve(null), 5000);

          if (!navigator.geolocation) {
            clearTimeout(timer);
            resolve(null);
            return;
          }

          navigator.geolocation.getCurrentPosition(
            (pos) => {
              clearTimeout(timer);
              resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
            },
            () => {
              clearTimeout(timer);
              resolve(null);
            },
            { enableHighAccuracy: true, timeout: 5000 }
          );
        });
      }

      // Native: expo-location
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return null;

      const location = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
      ]);

      if (location && 'coords' in location) {
        return { latitude: location.coords.latitude, longitude: location.coords.longitude };
      }
      return null;
    } catch {
      return null;
    }
  };

  // ── Wyzwól SOS ──
  const triggerSOS = async (): Promise<void> => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Brak zalogowanego użytkownika');

      // GPS — nie blokuj SOS jeśli się nie uda
      const coords = await getLocation();

      // 1. INSERT alert_case (NAJWAŻNIEJSZE — musi przejść)
      const { data: alertCase, error: alertError } = await supabase
        .from('alert_cases')
        .insert({
          senior_id: user.id,
          type: 'sos',
          state: 'open',
          latitude: coords?.latitude ?? null,
          longitude: coords?.longitude ?? null,
        })
        .select()
        .single();

      if (alertError) throw alertError;

      setSosActive(true);
      setCurrentAlert(alertCase);

      // 2. Pobierz caregiverów i utwórz deliveries (try/catch — nie blokuje)
      try {
        const { data: pairs } = await supabase
          .from('care_pairs')
          .select('caregiver_id')
          .eq('senior_id', user.id)
          .eq('status', 'active');

        if (pairs && pairs.length > 0) {
          // Pobierz imię seniora do payload
          const { data: profile } = await supabase
            .from('users')
            .select('name')
            .eq('id', user.id)
            .single();

          const deliveries = pairs.map((pair) => ({
            alert_case_id: alertCase.id,
            recipient_id: pair.caregiver_id,
            channel: 'push' as const,
            attempt_no: 1,
            payload: {
              type: 'sos',
              senior_name: profile?.name || 'Senior',
              latitude: coords?.latitude ?? null,
              longitude: coords?.longitude ?? null,
            },
            status: 'sent' as const,
          }));

          await supabase.from('alert_deliveries').insert(deliveries);
        }
      } catch (deliveryErr) {
        console.error('Alert delivery error (SOS nadal aktywny):', deliveryErr);
      }
    } catch (err) {
      console.error('triggerSOS error:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // ── Potwierdź SOS (caregiver) ──
  const acknowledgeSOS = async (alertId: string): Promise<void> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('alert_cases')
        .update({
          state: 'acknowledged',
          acknowledged_by: user.id,
          acknowledged_at: new Date().toISOString(),
        })
        .eq('id', alertId);

      if (error) throw error;

      setCurrentAlert((prev) =>
        prev ? { ...prev, state: 'acknowledged', acknowledged_by: user.id, acknowledged_at: new Date().toISOString() } : null
      );
    } catch (err) {
      console.error('acknowledgeSOS error:', err);
      throw err;
    }
  };

  // ── Zamknij SOS (caregiver) ──
  const resolveSOS = async (alertId: string): Promise<void> => {
    try {
      const { error } = await supabase
        .from('alert_cases')
        .update({
          state: 'resolved',
          resolved_at: new Date().toISOString(),
        })
        .eq('id', alertId);

      if (error) throw error;

      setSosActive(false);
      setCurrentAlert(null);
    } catch (err) {
      console.error('resolveSOS error:', err);
      throw err;
    }
  };

  // ── Anuluj SOS (senior — fałszywy alarm) ──
  const cancelSOS = async (alertId: string): Promise<void> => {
    try {
      const { error } = await supabase
        .from('alert_cases')
        .update({ state: 'cancelled' })
        .eq('id', alertId);

      if (error) throw error;

      setSosActive(false);
      setCurrentAlert(null);
    } catch (err) {
      console.error('cancelSOS error:', err);
      throw err;
    }
  };

  return {
    sosActive,
    currentAlert,
    loading,
    triggerSOS,
    acknowledgeSOS,
    resolveSOS,
    cancelSOS,
    refreshAlert: checkActiveAlert,
  };
}
