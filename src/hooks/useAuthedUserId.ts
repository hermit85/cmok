import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

/**
 * Lightweight hook that returns the currently-authed user id.
 *
 * Uses supabase.auth.getSession() which reads from the session cache
 * (no DB round-trip). Use this when a component only needs user id —
 * e.g. to pass as attribution `src` in a share URL — without pulling
 * the whole profile + relationship via useRelationship(). That hook
 * does 2 selects, subscribes to AppState, and refreshes on foreground.
 * Most screens don't need that just to fire a share.
 *
 * Stays in sync with auth state changes so logout/login is reflected
 * without remount.
 */
export function useAuthedUserId(): string | null {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!cancelled) setUserId(session?.user?.id ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled) setUserId(session?.user?.id ?? null);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return userId;
}
