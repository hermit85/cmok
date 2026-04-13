// ============================================================
// Cmok — checkin-notify Edge Function
// Wysyła streak-aware push do recipienta po check-inie signalera.
// ============================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function isExpoPushToken(value: string | null | undefined): value is string {
  if (!value) return false;
  return value.startsWith('ExponentPushToken[') || value.startsWith('ExpoPushToken[');
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function computeStreak(checkinDates: string[]): number {
  const dateSet = new Set(checkinDates);
  const today = new Date();
  let streak = 0;
  for (let i = 0; i <= 30; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    if (dateSet.has(formatDate(d))) {
      streak++;
    } else if (i === 0) {
      continue; // today not checked in yet — skip, don't break
    } else {
      break;
    }
  }
  return streak;
}

function streakPushBody(name: string, streak: number, totalCount: number): string {
  // First ever check-in
  if (totalCount <= 1) return `${name} daje Ci pierwszy znak!`;
  // Comeback after gap
  if (streak === 1 && totalCount > 1) return `${name} wraca z dzisiejszym znakiem`;
  // Milestones
  if (streak === 7) return `${name} — cały tydzień! Nie zapomina o Tobie`;
  if (streak === 14) return `${name} — dwa tygodnie z rzędu!`;
  if (streak === 21) return `${name} — trzy tygodnie. To już nawyk!`;
  if (streak === 30) return `${name} — miesiąc razem!`;
  // Streak days
  if (streak >= 2 && streak <= 6) return `${name} — dzień ${streak} z rzędu`;
  // Default
  return `${name} dał(a) znak — wszystko OK`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonResponse({ error: 'Missing authorization header' }, 401);
  }

  const userSupabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const serviceSupabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const {
    data: { user },
    error: authError,
  } = await userSupabase.auth.getUser();

  if (authError || !user) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  try {
    // 1. Signaler's name
    const { data: profile } = await serviceSupabase
      .from('users')
      .select('id, name')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile) {
      return jsonResponse({ ok: true, skipped: 'no_profile' });
    }

    // 2. Active relationship → recipient
    const { data: pair } = await serviceSupabase
      .from('care_pairs')
      .select('id, caregiver_id')
      .eq('senior_id', user.id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    if (!pair) {
      return jsonResponse({ ok: true, skipped: 'no_active_relationship' });
    }

    // 3. Compute streak for push copy
    const today = new Date();
    const ago = new Date(today);
    ago.setDate(today.getDate() - 30);

    const [{ data: checkins }, { count: totalCount }] = await Promise.all([
      serviceSupabase
        .from('daily_checkins')
        .select('local_date')
        .eq('senior_id', user.id)
        .gte('local_date', formatDate(ago))
        .lte('local_date', formatDate(today)),
      serviceSupabase
        .from('daily_checkins')
        .select('*', { count: 'exact', head: true })
        .eq('senior_id', user.id),
    ]);

    const dates = (checkins || []).map((r: { local_date: string }) => r.local_date);
    const streak = computeStreak(dates);

    // 4. ALL circle members: primary recipient + trusted contacts
    const recipientIds = [pair.caregiver_id];

    const { data: trustedContacts } = await serviceSupabase
      .from('trusted_contacts')
      .select('user_id')
      .eq('relationship_id', pair.id)
      .eq('status', 'active');

    for (const tc of trustedContacts || []) {
      if (tc.user_id && !recipientIds.includes(tc.user_id)) {
        recipientIds.push(tc.user_id);
      }
    }

    const { data: devices } = await serviceSupabase
      .from('device_installations')
      .select('push_token')
      .in('user_id', recipientIds)
      .eq('notifications_enabled', true)
      .not('push_token', 'is', null);

    const tokens = (devices || [])
      .map((d) => d.push_token)
      .filter(isExpoPushToken);

    if (tokens.length === 0) {
      return jsonResponse({ ok: true, skipped: 'no_push_tokens' });
    }

    // 5. Send streak-aware push
    const signalerName = profile.name || 'Bliska osoba';
    const body = streakPushBody(signalerName, streak, totalCount || 0);

    const messages = tokens.map((token) => ({
      to: token,
      sound: 'default',
      title: 'Cmok',
      body,
      data: { type: 'daily_checkin', senior_id: user.id, streak },
      priority: 'normal' as const,
      channelId: 'default',
    }));

    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    return jsonResponse({ ok: true, sent: response.ok, streak, body });
  } catch (error) {
    return jsonResponse({ error: String(error) }, 500);
  }
});

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: CORS_HEADERS,
  });
}
