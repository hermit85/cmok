// ============================================================
// Cmok — weekly-summary Edge Function
// Wysyła niedzielny push do recipientów z podsumowaniem tygodnia.
// Wywoływana przez pg_cron w niedzielę wieczorem (18:00).
// ============================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function isExpoPushToken(v: string | null | undefined): v is string {
  if (!v) return false;
  return v.startsWith('ExponentPushToken[') || v.startsWith('ExpoPushToken[');
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function summaryBody(signalerName: string, daysOk: number): string {
  if (daysOk === 7) return `Tydzien z ${signalerName}: 7/7 — pelny tydzien!`;
  if (daysOk >= 5) return `Tydzien z ${signalerName}: ${daysOk}/7 znakow. Swietnie!`;
  if (daysOk >= 3) return `Tydzien z ${signalerName}: ${daysOk}/7 znakow.`;
  if (daysOk >= 1) return `Tydzien z ${signalerName}: ${daysOk}/7. Moze warto porozmawiac?`;
  return `Tydzien z ${signalerName}: brak znakow. Zadzwon i sprawdz.`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  const serviceSupabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    // Find all active pairs
    const { data: pairs } = await serviceSupabase
      .from('care_pairs')
      .select('id, senior_id, caregiver_id')
      .eq('status', 'active');

    if (!pairs || pairs.length === 0) {
      return jsonResponse({ ok: true, processed: 0 });
    }

    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(today.getDate() - 6);

    let sent = 0;

    for (const pair of pairs) {
      if (!pair.senior_id || !pair.caregiver_id) continue;

      // Count check-ins for this signaler in last 7 days
      const { count } = await serviceSupabase
        .from('daily_checkins')
        .select('*', { count: 'exact', head: true })
        .eq('senior_id', pair.senior_id)
        .gte('local_date', formatDate(weekAgo))
        .lte('local_date', formatDate(today));

      const daysOk = count || 0;

      // Get signaler name
      const { data: signalerProfile } = await serviceSupabase
        .from('users')
        .select('name')
        .eq('id', pair.senior_id)
        .maybeSingle();

      const signalerName = signalerProfile?.name || 'Bliska osoba';

      // Get recipient push tokens
      const { data: devices } = await serviceSupabase
        .from('device_installations')
        .select('push_token')
        .eq('user_id', pair.caregiver_id)
        .eq('notifications_enabled', true)
        .not('push_token', 'is', null);

      const tokens = (devices || []).map((d) => d.push_token).filter(isExpoPushToken);
      if (tokens.length === 0) continue;

      const messages = tokens.map((token) => ({
        to: token,
        sound: 'default',
        title: 'Cmok — podsumowanie tygodnia',
        body: summaryBody(signalerName, daysOk),
        data: { type: 'weekly_summary' },
        priority: 'normal' as const,
        channelId: 'default',
      }));

      await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(messages),
      });

      sent++;
    }

    return jsonResponse({ ok: true, processed: pairs.length, sent });
  } catch (error) {
    return jsonResponse({ error: String(error) }, 500);
  }
});

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS_HEADERS });
}
