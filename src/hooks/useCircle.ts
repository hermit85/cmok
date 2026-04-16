import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import { supabase } from '../services/supabase';
import type { AppRole, CircleMember } from '../types';
import { normalizeAppRole } from '../utils/roles';
import { resolveLabel } from '../utils/resolveLabel';

export function useCircle() {
  const [members, setMembers] = useState<CircleMember[]>([]);
  const [userRole, setUserRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCircle = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) {
        setError(profileError.message);
        return;
      }

      if (!profile) return;
      const normalizedRole = normalizeAppRole(profile.role);
      if (!normalizedRole) {
        setError('Unknown user role');
        return;
      }
      setUserRole(normalizedRole);

      const { data: pairs, error: pairsError } = await supabase
        .from('care_pairs')
        .select('*')
        .or(`senior_id.eq.${user.id},caregiver_id.eq.${user.id}`)
        .eq('status', 'active');

      if (pairsError) {
        setError(pairsError.message);
        return;
      }

      if (!pairs || pairs.length === 0) {
        setMembers([]);
        return;
      }

      const otherIds = pairs
        .map((pair) => (pair.senior_id === user.id ? pair.caregiver_id : pair.senior_id))
        .filter(Boolean);

      const uniqueIds = [...new Set(otherIds)];

      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, name, phone, role')
        .in('id', uniqueIds);

      if (usersError) {
        console.error('[useCircle] users query error:', usersError);
      }

      const userMap = new Map((users || []).map((circleUser) => [circleUser.id, circleUser]));

      const circleMembers: CircleMember[] = pairs
        .map((pair) => {
          const otherId = pair.senior_id === user.id ? pair.caregiver_id : pair.senior_id;
          const otherUser = userMap.get(otherId);

          if (!otherId) return null;

          // signaler_label = how recipient named the signaler (e.g. "Mama")
          // When recipient looks at signaler → use signaler_label
          // When signaler looks at recipient → use recipient's DB name (otherUser.name)
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

      setMembers(circleMembers);
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
