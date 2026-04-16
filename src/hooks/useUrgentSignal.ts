/**
 * useUrgentSignal — manages the urgent signal flow (pilny sygnał).
 *
 * Wraps the database "alert_cases" model with product-level naming.
 * Internal queries still use DB column names (senior_id, sos, etc.)
 * but the public API speaks product language.
 */

import { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import { supabase } from '../services/supabase';
import type { AlertCase, SupportCase, SupportParticipant, SupportViewerRole } from '../types';
import { normalizeAppRole } from '../utils/roles';
import { resolveLabel } from '../utils/resolveLabel';

/* ─── helpers ─── */

function normalizeDeliveryStatus(value: string | null | undefined): 'sent' | 'failed' | 'pending' {
  if (value === 'sent' || value === 'failed') return value;
  return 'pending';
}

async function getCurrentUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
}

async function loadViewerRelationships(userId: string) {
  const { data: profile } = await supabase
    .from('users').select('role').eq('id', userId).maybeSingle();

  const role = normalizeAppRole(profile?.role);
  const relationships = new Map<string, { id: string; senior_id: string; caregiver_id: string; signaler_label: string | null }>();

  if (role === 'signaler') {
    const { data: pairs } = await supabase
      .from('care_pairs').select('id, senior_id, caregiver_id, signaler_label')
      .eq('senior_id', userId).eq('status', 'active');
    for (const pair of pairs || []) relationships.set(pair.senior_id, pair);
  }

  if (role === 'recipient') {
    const { data: pairs } = await supabase
      .from('care_pairs').select('id, senior_id, caregiver_id, signaler_label')
      .eq('caregiver_id', userId).eq('status', 'active');
    for (const pair of pairs || []) relationships.set(pair.senior_id, pair);
  }

  const { data: trustedMemberships } = await supabase
    .from('trusted_contacts')
    .select('care_pairs!inner(id, senior_id, caregiver_id, signaler_label, status)')
    .eq('user_id', userId).eq('status', 'active').eq('care_pairs.status', 'active');

  for (const membership of trustedMemberships || []) {
    const pair = Array.isArray(membership.care_pairs) ? membership.care_pairs[0] : membership.care_pairs;
    if (pair?.senior_id) relationships.set(pair.senior_id, pair);
  }

  return { role, relationships };
}

async function getLocation(): Promise<{ latitude: number; longitude: number } | null> {
  try {
    if (Platform.OS === 'web') {
      return new Promise((resolve) => {
        const timer = setTimeout(() => resolve(null), 5000);
        if (!navigator.geolocation) { clearTimeout(timer); resolve(null); return; }
        navigator.geolocation.getCurrentPosition(
          (pos) => { clearTimeout(timer); resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }); },
          () => { clearTimeout(timer); resolve(null); },
          { enableHighAccuracy: true, timeout: 5000 },
        );
      });
    }
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
  } catch { return null; }
}

/* ─── public interface ─── */

export type UrgentPreflightResult =
  | { ok: true }
  | { ok: false; reason: 'no_auth' | 'no_relationship' | 'no_active_relationship' | 'wrong_role' };

export interface UrgentSignalState {
  /** Whether an urgent signal is currently active */
  isActive: boolean;
  /** The raw alert case from DB */
  currentAlert: AlertCase | null;
  /** Full case with participants, viewer role, claimer info */
  urgentCase: SupportCase | null;
  /** Loading state for actions */
  loading: boolean;
  /** Initial data loading */
  refreshing: boolean;
  /** Number of people in the circle who received the signal */
  circleCount: number;
  /** Check if urgent signal can be sent — returns reason if not */
  preflight: () => Promise<UrgentPreflightResult>;
  /** Send urgent signal (with optional location) */
  sendUrgentSignal: () => Promise<void>;
  /** Retry sending to circle */
  retrySend: () => Promise<void>;
  /** Claim: "I'm handling this" */
  claim: (alertId: string) => Promise<void>;
  /** Resolve: "All clear" */
  resolve: (alertId: string) => Promise<void>;
  /** Cancel: "False alarm" */
  cancel: (alertId: string) => Promise<void>;
  /** Force refresh */
  refresh: () => Promise<void>;
}

export function useUrgentSignal(): UrgentSignalState {
  const [isActive, setIsActive] = useState(false);
  const [currentAlert, setCurrentAlert] = useState<AlertCase | null>(null);
  const [urgentCase, setUrgentCase] = useState<SupportCase | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(true);

  const loadState = useCallback(async () => {
    setRefreshing(true);
    try {
      const userId = await getCurrentUserId();
      if (!userId) { setIsActive(false); setCurrentAlert(null); setUrgentCase(null); return; }

      const { relationships } = await loadViewerRelationships(userId);
      const candidateIds = [...new Set([userId, ...relationships.keys()])];

      if (candidateIds.length === 0) { setIsActive(false); setCurrentAlert(null); setUrgentCase(null); return; }

      const { data: alerts } = await supabase
        .from('alert_cases').select('*')
        .in('senior_id', candidateIds).eq('type', 'sos')
        .in('state', ['open', 'acknowledged'])
        .order('triggered_at', { ascending: false }).limit(10);

      const alert = (alerts || [])[0] || null;
      if (!alert) { setIsActive(false); setCurrentAlert(null); setUrgentCase(null); return; }

      const relRow = relationships.get(alert.senior_id) || null;
      if (!relRow) { setIsActive(true); setCurrentAlert(alert); setUrgentCase(null); return; }

      const rel = { id: relRow.id, signalerUserId: relRow.senior_id, recipientUserId: relRow.caregiver_id, signalerLabel: relRow.signaler_label };

      const [{ data: trustedContacts }, { data: deliveries }] = await Promise.all([
        supabase.from('trusted_contacts').select('id, user_id, status')
          .eq('relationship_id', rel.id).eq('status', 'active'),
        supabase.from('alert_deliveries').select('recipient_id, status, sent_at')
          .eq('alert_case_id', alert.id).eq('channel', 'push')
          .order('sent_at', { ascending: false }),
      ]);

      const trustedUserIds = (trustedContacts || []).map((c) => c.user_id);
      const userIds = [...new Set([rel.signalerUserId, rel.recipientUserId, ...trustedUserIds, alert.acknowledged_by].filter(Boolean))];
      const { data: users } = userIds.length > 0
        ? await supabase.from('users').select('id, name, phone').in('id', userIds)
        : { data: [] as Array<{ id: string; name: string; phone: string }> };

      const userMap = new Map((users || []).map((u) => [u.id, u]));
      const latestDelivery = new Map<string, { status: 'sent' | 'failed'; sent_at: string }>();
      for (const d of deliveries || []) {
        if (!latestDelivery.has(d.recipient_id)) {
          latestDelivery.set(d.recipient_id, { status: d.status, sent_at: d.sent_at });
        }
      }

      const participants: SupportParticipant[] = [
        {
          userId: rel.recipientUserId,
          name: userMap.get(rel.recipientUserId)?.name || 'Bliska osoba',
          phone: userMap.get(rel.recipientUserId)?.phone || '',
          kind: 'primary',
          deliveryStatus: normalizeDeliveryStatus(latestDelivery.get(rel.recipientUserId)?.status),
          isClaimedBy: alert.acknowledged_by === rel.recipientUserId,
        },
        ...(trustedContacts || []).map((c) => ({
          userId: c.user_id,
          name: userMap.get(c.user_id)?.name || 'Bliska osoba',
          phone: userMap.get(c.user_id)?.phone || '',
          kind: 'trusted' as const,
          deliveryStatus: normalizeDeliveryStatus(latestDelivery.get(c.user_id)?.status),
          isClaimedBy: alert.acknowledged_by === c.user_id,
        })),
      ];

      let viewerRole: SupportViewerRole = 'trusted';
      if (userId === rel.signalerUserId) viewerRole = 'signaler';
      else if (userId === rel.recipientUserId) viewerRole = 'primary';

      setIsActive(true);
      setCurrentAlert(alert);
      setUrgentCase({
        alert, relationshipId: rel.id, viewerUserId: userId,
        signalerId: rel.signalerUserId, signalerName: resolveLabel(rel.signalerLabel, userMap.get(rel.signalerUserId)?.name),
        primaryRecipientId: rel.recipientUserId,
        claimerId: alert.acknowledged_by,
        claimerName: alert.acknowledged_by ? userMap.get(alert.acknowledged_by)?.name || 'Bliska osoba' : null,
        viewerRole, participants,
      });
    } catch (error) {
      console.error('[useUrgentSignal] loadState error:', error);
      setIsActive(false); setCurrentAlert(null); setUrgentCase(null);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadState(); }, [loadState]);

  useEffect(() => {
    const ch1 = supabase.channel('urgent-alert-cases')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alert_cases' }, () => loadState())
      .subscribe();
    const ch2 = supabase.channel('urgent-alert-deliveries')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alert_deliveries' }, () => loadState())
      .subscribe();
    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2); };
  }, [loadState]);

  const callEdgeFunction = useCallback(async (payload: Record<string, unknown>) => {
    // Ensure session is fresh before invoking (handles expired JWTs)
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      const { data: refreshed } = await supabase.auth.refreshSession();
      if (!refreshed.session) throw new Error('Unauthorized');
    }
    const { data, error } = await supabase.functions.invoke('urgent-signal', { body: payload });
    if (error) {
      console.warn('[urgent-signal] edge function error:', error);
      // Detect 401 from FunctionsHttpError context
      const status = (error as { context?: { status?: number } })?.context?.status;
      if (status === 401) throw new Error('Unauthorized');
      throw new Error(error.message || 'Urgent signal failed');
    }
    return data;
  }, []);

  /** Pre-check: can urgent signal be sent? */
  const preflight = useCallback(async (): Promise<UrgentPreflightResult> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return { ok: false, reason: 'no_auth' };

    const { data: profile } = await supabase
      .from('users').select('role').eq('id', session.user.id).maybeSingle();
    if (!profile) return { ok: false, reason: 'no_auth' };

    const role = normalizeAppRole(profile.role);
    if (role !== 'signaler') return { ok: false, reason: 'wrong_role' };

    const { data: pair } = await supabase
      .from('care_pairs').select('id, status')
      .eq('senior_id', session.user.id).eq('status', 'active').limit(1).maybeSingle();

    if (!pair) return { ok: false, reason: 'no_active_relationship' };

    return { ok: true };
  }, []);

  const sendUrgentSignal = useCallback(async () => {
    setLoading(true);
    try {
      const coords = await getLocation();
      await callEdgeFunction({ action: 'trigger', latitude: coords?.latitude ?? null, longitude: coords?.longitude ?? null });
      await loadState();
    } catch (err) {
      // Re-throw with typed message for UI to handle
      const msg = err instanceof Error ? err.message : 'Unknown error';
      if (msg.includes('not found')) throw new Error('NO_RELATIONSHIP');
      if (msg.includes('Unauthorized')) throw new Error('NO_AUTH');
      throw err;
    } finally { setLoading(false); }
  }, [callEdgeFunction, loadState]);

  const retrySend = useCallback(async () => {
    if (!currentAlert) throw new Error('Brak aktywnego sygnału');
    setLoading(true);
    try {
      await callEdgeFunction({ action: 'retry', alert_id: currentAlert.id });
      await loadState();
    } finally { setLoading(false); }
  }, [callEdgeFunction, currentAlert, loadState]);

  const claim = useCallback(async (alertId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.rpc('claim_support_alert', { p_alert_id: alertId });
      if (error) throw error;
      await loadState();
    } finally { setLoading(false); }
  }, [loadState]);

  const resolve = useCallback(async (alertId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.rpc('resolve_support_alert', { p_alert_id: alertId });
      if (error) throw error;
      await loadState();
    } finally { setLoading(false); }
  }, [loadState]);

  const cancel = useCallback(async (alertId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.from('alert_cases').update({ state: 'cancelled' }).eq('id', alertId);
      if (error) throw error;
      await loadState();
    } finally { setLoading(false); }
  }, [loadState]);

  return {
    isActive, currentAlert, urgentCase, loading, refreshing,
    circleCount: urgentCase?.participants.length || 0,
    preflight, sendUrgentSignal, retrySend, claim, resolve, cancel,
    refresh: loadState,
  };
}
