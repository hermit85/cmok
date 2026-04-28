import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import { supabase } from '../services/supabase';
import type { AppRole, CircleMember } from '../types';
import { normalizeAppRole } from '../utils/roles';
import { resolveLabel } from '../utils/resolveLabel';
import { createDedupedFetch } from '../utils/requestDedup';

interface CircleResult {
  members: CircleMember[];
  userRole: AppRole | null;
  error: string | null;
}

/**
 * Raw circle fetch — pulled out so createDedupedFetch can wrap it.
 * Runs the 3 SELECTs in sequence (role → pairs → other users) because
 * each depends on the previous. Result shape is the snapshot used by
 * the hook.
 */
async function fetchCircleImpl(): Promise<CircleResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { members: [], userRole: null, error: null };

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) return { members: [], userRole: null, error: profileError.message };
  if (!profile) return { members: [], userRole: null, error: null };

  const normalizedRole = normalizeAppRole(profile.role);
  if (!normalizedRole) return { members: [], userRole: null, error: 'Unknown user role' };

  // Deterministic order — earliest joined pair wins as [0]. Matters when
  // multi-pair ships for real (RecipientHome + SignalerHome still read
  // signalers[0] / recipients[0]; random ordering would pick a
  // different "primary" on every render).
  const { data: pairs, error: pairsError } = await supabase
    .from('care_pairs')
    .select('*')
    .or(`senior_id.eq.${user.id},caregiver_id.eq.${user.id}`)
    .eq('status', 'active')
    .order('joined_at', { ascending: true });

  if (pairsError) return { members: [], userRole: normalizedRole, error: pairsError.message };
  if (!pairs || pairs.length === 0) return { members: [], userRole: normalizedRole, error: null };

  const otherIds = pairs
    .map((pair) => (pair.senior_id === user.id ? pair.caregiver_id : pair.senior_id))
    .filter(Boolean);

  const uniqueIds = [...new Set(otherIds)];

  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, name, phone, role')
    .in('id', uniqueIds);

  if (usersError) console.error('[useCircle] users query error:', usersError);

  const userMap = new Map((users || []).map((circleUser) => [circleUser.id, circleUser]));

  const circleMembers: CircleMember[] = pairs
    .map((pair) => {
      const otherId = pair.senior_id === user.id ? pair.caregiver_id : pair.senior_id;
      const otherUser = userMap.get(otherId);
      if (!otherId) return null;

      const isViewingSignaler = pair.senior_id === otherId;
      const relLabel = isViewingSignaler ? (pair.signaler_label || pair.senior_name) : null;
      const resolvedName = resolveLabel(relLabel, otherUser?.name);

      return {
        userId: otherId,
        name: resolvedName,
        phone: otherUser?.phone || '',
        role: normalizeAppRole(otherUser?.role) || (pair.senior_id === user.id ? 'recipient' : 'signaler'),
        relationshipId: pair.id,
      };
    })
    .filter((member): member is CircleMember => !!member);

  return { members: circleMembers, userRole: normalizedRole, error: null };
}

/**
 * Module-level dedup — same motivation as useRelationship (see Sentry
 * "App hanging 2000 ms" trace from 2026-04-18). Prevents concurrent
 * screens (Settings + Circle + RecipientHome) from firing the same
 * 3-query set in parallel.
 */
const dedupedFetch = createDedupedFetch(fetchCircleImpl);
supabase.auth.onAuthStateChange(() => dedupedFetch.invalidate());

/** Pre-warm the circle cache from outside React (e.g. from the push tap
 *  handler in _layout.tsx). The destination home route then lazy-seeds
 *  from this cache and skips the inner "Sprawdzamy dzisiejszy znak…"
 *  spinner that gates the screen on circleLoading. Fire-and-forget. */
export function prefetchCircle(): Promise<CircleResult> {
  return dedupedFetch();
}

export function useCircle() {
  // Lazy-seed from dedup cache (see useRelationship for rationale): when
  // index.tsx already fetched the circle and the home route remounts useCircle,
  // we want the home to render with members in-hand instead of flashing a
  // "Sprawdzamy dzisiejszy znak…" spinner while a redundant fetch flies.
  const seed = dedupedFetch.peek();
  const [members, setMembers] = useState<CircleMember[]>(seed?.members ?? []);
  const [userRole, setUserRole] = useState<AppRole | null>(seed?.userRole ?? null);
  const [loading, setLoading] = useState(seed === null);
  const [error, setError] = useState<string | null>(seed?.error ?? null);
  const hasEverLoaded = useRef(seed !== null);

  const fetchCircle = useCallback(async () => {
    if (!hasEverLoaded.current) setLoading(true);
    setError(null);
    try {
      const result = await dedupedFetch();
      setMembers(result.members);
      setUserRole(result.userRole);
      setError(result.error);
      hasEverLoaded.current = true;
    } catch (err) {
      console.error('[useCircle] fetchCircle error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  // Refresh on app foreground so circle reflects remote changes (e.g. the
  // other side deleted their account). Throttled to 30s — mirrors
  // useRelationship behaviour. Without this, a signaler whose recipient
  // vanished would keep showing stale circle until remount.
  const lastForegroundRefresh = useRef(0);
  useEffect(() => {
    fetchCircle();

    const FOREGROUND_REFRESH_THROTTLE_MS = 30_000;
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      const now = Date.now();
      if (now - lastForegroundRefresh.current < FOREGROUND_REFRESH_THROTTLE_MS) return;
      lastForegroundRefresh.current = now;
      fetchCircle();
    });
    return () => sub.remove();
  }, [fetchCircle]);

  const signalers = members.filter((member) => member.role === 'signaler');
  const recipients = members.filter((member) => member.role === 'recipient');

  return {
    members,
    signalers,
    recipients,
    circleCount: members.length,
    userRole,
    loading,
    error,
    refreshCircle: fetchCircle,
  };
}
