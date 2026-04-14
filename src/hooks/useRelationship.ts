import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import type { AppProfile, AppRole, Relationship, RelationshipStatus } from '../types';
import { normalizeAppRole } from '../utils/roles';

interface RelationshipState {
  loading: boolean;
  sessionReady: boolean;
  profile: AppProfile | null;
  relationship: Relationship | null;
  status: RelationshipStatus;
  hasTrustedAccess: boolean;
  refreshRelationship: () => Promise<void>;
}

function mapRelationship(raw: any): Relationship {
  return {
    id: raw.id,
    signalerUserId: raw.senior_id ?? null,
    recipientUserId: raw.caregiver_id,
    signalerLabel: raw.signaler_label || raw.senior_name || null,
    inviteCode: raw.invite_code ?? null,
    inviteExpiresAt: raw.invite_expires_at ?? null,
    status: raw.status,
    joinedAt: raw.joined_at ?? null,
  };
}

async function fetchProfileAndRelationship(): Promise<{
  profile: AppProfile | null;
  relationship: Relationship | null;
  status: RelationshipStatus;
  hasTrustedAccess: boolean;
}> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    return { profile: null, relationship: null, status: 'none', hasTrustedAccess: false };
  }

  // Fetch profile first (needed to determine role for relationship query)
  const { data: profile } = await supabase
    .from('users')
    .select('id, phone, name, role, checkin_time, timezone')
    .eq('id', session.user.id)
    .maybeSingle();

  if (!profile) {
    return { profile: null, relationship: null, status: 'none', hasTrustedAccess: false };
  }

  const role = normalizeAppRole(profile.role);
  if (!role) {
    return { profile: null, relationship: null, status: 'none', hasTrustedAccess: false };
  }
  const relationshipLookupColumn = role === 'recipient' ? 'caregiver_id' : 'senior_id';
  const relationshipStatuses = role === 'recipient' ? ['active', 'pending'] : ['active'];

  // Run relationship + trusted access queries in parallel
  const [{ data: rawRelationships }, { data: trustedMemberships }] = await Promise.all([
    supabase
      .from('care_pairs')
      .select('id, senior_id, caregiver_id, signaler_label, senior_name, invite_code, invite_expires_at, status, joined_at')
      .eq(relationshipLookupColumn, session.user.id)
      .in('status', relationshipStatuses)
      .limit(5),
    supabase
      .from('trusted_contacts')
      .select('id, care_pairs!inner(id, status)')
      .eq('user_id', session.user.id)
      .eq('status', 'active')
      .eq('care_pairs.status', 'active')
      .limit(1),
  ]);

  const preferredRelationship = (rawRelationships || []).sort((a, b) => {
    if (a.status === b.status) return 0;
    return a.status === 'active' ? -1 : 1;
  })[0];

  const relationship = preferredRelationship ? mapRelationship(preferredRelationship) : null;

  return {
    profile: {
      id: profile.id,
      phone: profile.phone,
      name: profile.name,
      role,
      checkinTime: profile.checkin_time,
      timezone: profile.timezone,
    },
    relationship,
    status: relationship?.status ?? 'none',
    hasTrustedAccess: (trustedMemberships || []).length > 0,
  };
}

export function useRelationship(): RelationshipState {
  const [loading, setLoading] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);
  const [profile, setProfile] = useState<AppProfile | null>(null);
  const [relationship, setRelationship] = useState<Relationship | null>(null);
  const [status, setStatus] = useState<RelationshipStatus>('none');
  const [hasTrustedAccess, setHasTrustedAccess] = useState(false);

  const refreshRelationship = useCallback(async () => {
    setLoading(true);
    try {
      const next = await fetchProfileAndRelationship();
      setProfile(next.profile);
      setRelationship(next.relationship);
      setStatus(next.status);
      setHasTrustedAccess(next.hasTrustedAccess);
      setSessionReady(true);
    } catch (err) {
      console.error('[useRelationship] refresh error:', err);
      setProfile(null);
      setRelationship(null);
      setStatus('none');
      setHasTrustedAccess(false);
      setSessionReady(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshRelationship();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      refreshRelationship();
    });

    return () => subscription.unsubscribe();
  }, [refreshRelationship]);

  return {
    loading,
    sessionReady,
    profile,
    relationship,
    status,
    hasTrustedAccess,
    refreshRelationship,
  };
}
