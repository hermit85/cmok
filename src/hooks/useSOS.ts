import { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import { supabase, SUPABASE_URL } from '../services/supabase';
import type { AlertCase, SupportCase, SupportParticipant, SupportViewerRole } from '../types';
import { normalizeAppRole } from '../utils/roles';

function normalizeDeliveryStatus(value: string | null | undefined): 'sent' | 'failed' | 'pending' {
  if (value === 'sent' || value === 'failed') return value;
  return 'pending';
}

async function getCurrentUserId(): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user?.id || null;
}

async function loadViewerRelationships(userId: string) {
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  const role = normalizeAppRole(profile?.role);
  const relationships = new Map<string, { id: string; senior_id: string; caregiver_id: string }>();

  if (role === 'signaler') {
    const { data: pairs } = await supabase
      .from('care_pairs')
      .select('id, senior_id, caregiver_id')
      .eq('senior_id', userId)
      .eq('status', 'active');

    for (const pair of pairs || []) {
      relationships.set(pair.senior_id, pair);
    }
  }

  if (role === 'recipient') {
    const { data: pairs } = await supabase
      .from('care_pairs')
      .select('id, senior_id, caregiver_id')
      .eq('caregiver_id', userId)
      .eq('status', 'active');

    for (const pair of pairs || []) {
      relationships.set(pair.senior_id, pair);
    }
  }

  const { data: trustedMemberships } = await supabase
    .from('trusted_contacts')
    .select('care_pairs!inner(id, senior_id, caregiver_id, status)')
    .eq('user_id', userId)
    .eq('status', 'active')
    .eq('care_pairs.status', 'active');

  for (const membership of trustedMemberships || []) {
    const pair = Array.isArray(membership.care_pairs) ? membership.care_pairs[0] : membership.care_pairs;
    if (pair?.senior_id) {
      relationships.set(pair.senior_id, pair);
    }
  }

  return {
    role,
    relationships,
  };
}

async function getLocation(): Promise<{ latitude: number; longitude: number } | null> {
  try {
    if (Platform.OS === 'web') {
      return new Promise((resolve) => {
        const timer = setTimeout(() => resolve(null), 5000);

        if (!navigator.geolocation) {
          clearTimeout(timer);
          resolve(null);
          return;
        }

        navigator.geolocation.getCurrentPosition(
          (position) => {
            clearTimeout(timer);
            resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude });
          },
          () => {
            clearTimeout(timer);
            resolve(null);
          },
          { enableHighAccuracy: true, timeout: 5000 }
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
  } catch {
    return null;
  }
}

export function useSOS() {
  const [sosActive, setSosActive] = useState(false);
  const [currentAlert, setCurrentAlert] = useState<AlertCase | null>(null);
  const [supportCase, setSupportCase] = useState<SupportCase | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(true);

  const loadSupportState = useCallback(async () => {
    setRefreshing(true);

    try {
      const userId = await getCurrentUserId();
      if (!userId) {
        setSosActive(false);
        setCurrentAlert(null);
        setSupportCase(null);
        return;
      }

      const { relationships } = await loadViewerRelationships(userId);
      const candidateSignalerIds = [...new Set([userId, ...relationships.keys()])];

      if (candidateSignalerIds.length === 0) {
        setSosActive(false);
        setCurrentAlert(null);
        setSupportCase(null);
        return;
      }

      const { data: alerts } = await supabase
        .from('alert_cases')
        .select('*')
        .in('senior_id', candidateSignalerIds)
        .eq('type', 'sos')
        .in('state', ['open', 'acknowledged'])
        .order('triggered_at', { ascending: false })
        .limit(10);

      const alert = (alerts || [])[0] || null;

      if (!alert) {
        setSosActive(false);
        setCurrentAlert(null);
        setSupportCase(null);
        return;
      }

      const relationshipRow = relationships.get(alert.senior_id) || null;

      if (!relationshipRow) {
        setSosActive(true);
        setCurrentAlert(alert);
        setSupportCase(null);
        return;
      }

      const relationship = {
        id: relationshipRow.id,
        signalerUserId: relationshipRow.senior_id,
        recipientUserId: relationshipRow.caregiver_id,
      };

      const [{ data: trustedContacts }, { data: deliveries }] = await Promise.all([
        supabase
          .from('trusted_contacts')
          .select('id, user_id, status')
          .eq('relationship_id', relationship.id)
          .eq('status', 'active'),
        supabase
          .from('alert_deliveries')
          .select('recipient_id, status, sent_at')
          .eq('alert_case_id', alert.id)
          .eq('channel', 'push')
          .order('sent_at', { ascending: false }),
      ]);

      const trustedUserIds = (trustedContacts || []).map((contact) => contact.user_id);
      const userIds = [...new Set([relationship.signalerUserId, relationship.recipientUserId, ...trustedUserIds, alert.acknowledged_by].filter(Boolean))];

      const { data: users } = userIds.length > 0
        ? await supabase.from('users').select('id, name, phone').in('id', userIds)
        : { data: [] as Array<{ id: string; name: string; phone: string }> };

      const userMap = new Map((users || []).map((user) => [user.id, user]));
      const latestDeliveryByRecipient = new Map<string, { status: 'sent' | 'failed'; sent_at: string }>();

      for (const delivery of deliveries || []) {
        if (!latestDeliveryByRecipient.has(delivery.recipient_id)) {
          latestDeliveryByRecipient.set(delivery.recipient_id, {
            status: delivery.status,
            sent_at: delivery.sent_at,
          });
        }
      }

      const participants: SupportParticipant[] = [
        {
          userId: relationship.recipientUserId,
          name: userMap.get(relationship.recipientUserId)?.name || 'Bliska osoba',
          phone: userMap.get(relationship.recipientUserId)?.phone || '',
          kind: 'primary',
          deliveryStatus: normalizeDeliveryStatus(latestDeliveryByRecipient.get(relationship.recipientUserId)?.status),
          isClaimedBy: alert.acknowledged_by === relationship.recipientUserId,
        },
        ...(trustedContacts || []).map((contact) => ({
          userId: contact.user_id,
          name: userMap.get(contact.user_id)?.name || 'Osoba zaufana',
          phone: userMap.get(contact.user_id)?.phone || '',
          kind: 'trusted' as const,
          deliveryStatus: normalizeDeliveryStatus(latestDeliveryByRecipient.get(contact.user_id)?.status),
          isClaimedBy: alert.acknowledged_by === contact.user_id,
        })),
      ];

      let viewerRole: SupportViewerRole = 'trusted';
      if (userId === relationship.signalerUserId) viewerRole = 'signaler';
      else if (userId === relationship.recipientUserId) viewerRole = 'primary';

      setSosActive(true);
      setCurrentAlert(alert);
      setSupportCase({
        alert,
        relationshipId: relationship.id,
        viewerUserId: userId,
        signalerId: relationship.signalerUserId,
        signalerName: userMap.get(relationship.signalerUserId)?.name || 'Bliska osoba',
        primaryRecipientId: relationship.recipientUserId,
        claimerId: alert.acknowledged_by,
        claimerName: alert.acknowledged_by ? userMap.get(alert.acknowledged_by)?.name || 'Bliska osoba' : null,
        viewerRole,
        participants,
      });
    } catch (error) {
      console.error('[useSOS] loadSupportState error:', error);
      setSosActive(false);
      setCurrentAlert(null);
      setSupportCase(null);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadSupportState();
  }, [loadSupportState]);

  useEffect(() => {
    const alertsChannel = supabase
      .channel('support-alert-cases')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'alert_cases' },
        () => loadSupportState()
      )
      .subscribe();

    const deliveriesChannel = supabase
      .channel('support-alert-deliveries')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'alert_deliveries' },
        () => loadSupportState()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(alertsChannel);
      supabase.removeChannel(deliveriesChannel);
    };
  }, [loadSupportState]);

  const callSupportAlertFunction = useCallback(async (payload: Record<string, unknown>) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) throw new Error('Brak zalogowanego użytkownika');

    const response = await fetch(`${SUPABASE_URL}/functions/v1/support-alert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(payload),
    });

    const json = await response.json();

    if (!response.ok) {
      throw new Error(json?.error || 'Support alert failed');
    }

    return json;
  }, []);

  const triggerSOS = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const coords = await getLocation();
      await callSupportAlertFunction({
        action: 'trigger',
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
      });
      await loadSupportState();
    } finally {
      setLoading(false);
    }
  }, [callSupportAlertFunction, loadSupportState]);

  const retrySOS = useCallback(async (): Promise<void> => {
    if (!currentAlert) throw new Error('Brak aktywnej sprawy');

    setLoading(true);
    try {
      await callSupportAlertFunction({
        action: 'retry',
        alert_id: currentAlert.id,
      });
      await loadSupportState();
    } finally {
      setLoading(false);
    }
  }, [callSupportAlertFunction, currentAlert, loadSupportState]);

  const acknowledgeSOS = useCallback(async (alertId: string): Promise<void> => {
    setLoading(true);
    try {
      const { error } = await supabase.rpc('claim_support_alert', {
        p_alert_id: alertId,
      });

      if (error) throw error;

      await loadSupportState();
    } finally {
      setLoading(false);
    }
  }, [loadSupportState]);

  const resolveSOS = useCallback(async (alertId: string): Promise<void> => {
    setLoading(true);
    try {
      const { error } = await supabase.rpc('resolve_support_alert', {
        p_alert_id: alertId,
      });

      if (error) throw error;

      await loadSupportState();
    } finally {
      setLoading(false);
    }
  }, [loadSupportState]);

  const cancelSOS = useCallback(async (alertId: string): Promise<void> => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('alert_cases')
        .update({ state: 'cancelled' })
        .eq('id', alertId);

      if (error) throw error;

      await loadSupportState();
    } finally {
      setLoading(false);
    }
  }, [loadSupportState]);

  return {
    sosActive,
    currentAlert,
    supportCase,
    loading,
    refreshing,
    recipientCount: supportCase?.participants.length || 0,
    triggerSOS,
    retrySOS,
    acknowledgeSOS,
    resolveSOS,
    cancelSOS,
    refreshAlert: loadSupportState,
  };
}
