import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { supabase } from '../services/supabase';
import type { AppProfile, AppRole, Relationship, RelationshipStatus } from '../types';
import { normalizeAppRole } from '../utils/roles';
import { createDedupedFetch } from '../utils/requestDedup';

interface RelationshipState {
  loading: boolean;
  sessionReady: boolean;
  profile: AppProfile | null;
  relationship: Relationship | null;
  status: RelationshipStatus;
  hasTrustedAccess: boolean;
  /** Pass `forceFresh=true` on manual refresh (buttons, post-mutation) to
   *  bypass the 500ms dedup cache. Default false for mount/auth/foreground. */
  refreshRelationship: (forceFresh?: boolean) => Promise<void>;
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

/**
 * Module-level dedup for profile+relationship fetches. Multiple screens
 * (Settings, Circle, TrustedContacts, WaitingForConnection) all call
 * useRelationship. A Settings → Circle transition briefly mounts both,
 * firing 2× the same SELECTs. Deduped here.
 */
const dedupedFetch = createDedupedFetch(fetchProfileAndRelationship);

// Invalidate cache on auth change so a new session always fetches fresh.
supabase.auth.onAuthStateChange(() => dedupedFetch.invalidate());

/**
 * Warm the dedup cache from outside the React tree. The push tap handler
 * uses this on cold start so by the time it calls router.replace and the
 * home route mounts useRelationship, the data is already cached and the
 * route renders without a LoadingScreen flash. Returns the same result
 * the hook would see — callers can pull `profile.role` for routing
 * without firing a second query.
 */
export function prefetchRelationship(): ReturnType<typeof fetchProfileAndRelationship> {
  return dedupedFetch();
}

export function useRelationship(): RelationshipState {
  // Lazy-seed from dedup cache: when index.tsx fetched profile + redirects to
  // /recipient-home, the home route remounts useRelationship. Without this seed,
  // the new instance starts with loading=true → LoadingScreen flashes for one
  // frame even though the data is already known. Seeding from peek() makes
  // index→home navigation render the home screen instantly on warm cache.
  const seed = dedupedFetch.peek();
  const [loading, setLoading] = useState(seed === null);
  const [sessionReady, setSessionReady] = useState(seed !== null);
  const [profile, setProfile] = useState<AppProfile | null>(seed?.profile ?? null);
  const [relationship, setRelationship] = useState<Relationship | null>(seed?.relationship ?? null);
  const [status, setStatus] = useState<RelationshipStatus>(seed?.status ?? 'none');
  const [hasTrustedAccess, setHasTrustedAccess] = useState(seed?.hasTrustedAccess ?? false);
  const hasEverLoaded = useRef(seed !== null);
  const retryCount = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // `forceFresh` — when true, bypass the 500ms dedup cache. Use for manual
  // refresh (user taps "Sprawdź", polling in /waiting, pull-to-refresh).
  // Default false for internal mount/foreground/auth-change triggers where
  // sharing a fetch across components is a feature, not a bug.
  const refreshRelationship = useCallback(async (forceFresh = false) => {
    // Don't show loading state if we already have data — background refresh
    // shouldn't flash a spinner. Manual forceFresh always shows loading.
    if (forceFresh || !hasEverLoaded.current) setLoading(true);
    try {
      const next = forceFresh ? await dedupedFetch.refresh() : await dedupedFetch();
      setProfile(next.profile);
      setRelationship(next.relationship);
      setStatus(next.status);
      setHasTrustedAccess(next.hasTrustedAccess);
      hasEverLoaded.current = true;
      retryCount.current = 0;
      setSessionReady(true);
    } catch (err) {
      console.error('[useRelationship] refresh error:', err);
      if (hasEverLoaded.current) {
        // Already loaded once — keep stale data
      } else if (retryCount.current < 3) {
        // First load failed — retry up to 3 times
        retryCount.current += 1;
        retryTimer.current = setTimeout(() => refreshRelationship(true), 3000);
      } else {
        // Give up — show app with null state (will route to onboarding)
        setSessionReady(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const lastForegroundRefresh = useRef(0);
  useEffect(() => {
    refreshRelationship();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      refreshRelationship();
    });

    // Refresh on app foreground so stale relationship state (e.g. after the
    // other side deleted their account) gets reconciled. Throttled to 30s.
    const FOREGROUND_REFRESH_THROTTLE_MS = 30_000;
    const appStateSub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      const now = Date.now();
      if (now - lastForegroundRefresh.current < FOREGROUND_REFRESH_THROTTLE_MS) return;
      lastForegroundRefresh.current = now;
      refreshRelationship();
    });

    return () => {
      subscription.unsubscribe();
      appStateSub.remove();
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
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
