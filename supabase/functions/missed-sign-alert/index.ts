// ============================================================
// Cmok — missed-sign-alert Edge Function
// Jeśli signaler nie dał znaku przez 24h — powiadamiamy krąg.
// "[Imię] nie dał(a) znaku od wczoraj. Sprawdź czy wszystko OK."
// Wywoływana przez pg_cron codziennie o 20:00.
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  const serviceSupabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const today = formatDate(new Date());
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = formatDate(yesterday);

    // Find active pairs
    const { data: pairs } = await serviceSupabase
      .from('care_pairs')
      .select('id, senior_id, caregiver_id')
      .eq('status', 'active')
      .not('senior_id', 'is', null);

    if (!pairs || pairs.length === 0) {
      return jsonResponse({ ok: true, processed: 0 });
    }

    let sent = 0;

    for (const pair of pairs) {
      if (!pair.senior_id) continue;

      // Check if signaler checked in today OR yesterday
      const { data: recentCheckin } = await serviceSupabase
        .from('daily_checkins')
        .select('id')
        .eq('senior_id', pair.senior_id)
        .gte('local_date', yesterdayStr)
        .lte('local_date', today)
        .limit(1)
        .maybeSingle();

      if (recentCheckin) continue; // Checked in recently — skip

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
        title: 'Cmok',
        body: `${signalerName} nie dal(a) znaku od wczoraj. Sprawdz czy wszystko OK.`,
        data: { type: 'missed_sign_alert' },
        priority: 'high' as const,
        channelId: 'urgent',
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
