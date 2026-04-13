// ============================================================
// Cmok — morning-reminder Edge Function
// Wysyła poranne przypomnienie do signalera jeśli nie dał znaku.
// Wywoływana przez pg_cron codziennie o 9:00.
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

function reminderBody(recipientName: string, streak: number): string {
  if (streak >= 7) return `${streak} dni z rzędu! Nie przerywaj — daj dziś znak`;
  if (streak >= 2) return `${streak} dni z rzędu. Daj dziś znak ${recipientName}`;
  return `Dzień dobry! ${recipientName} czeka na Twój znak`;
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

    // Find active pairs where signaler hasn't checked in today
    const { data: pairs } = await serviceSupabase
      .from('care_pairs')
      .select('id, senior_id, caregiver_id, signaler_label')
      .eq('status', 'active')
      .not('senior_id', 'is', null);

    if (!pairs || pairs.length === 0) {
      return jsonResponse({ ok: true, processed: 0 });
    }

    let sent = 0;

    for (const pair of pairs) {
      if (!pair.senior_id) continue;

      // Check if already checked in today
      const { data: todayCheckin } = await serviceSupabase
        .from('daily_checkins')
        .select('id')
        .eq('senior_id', pair.senior_id)
        .eq('local_date', today)
        .limit(1)
        .maybeSingle();

      if (todayCheckin) continue; // Already checked in — skip

      // Get recipient name for personalized copy
      const { data: recipientProfile } = await serviceSupabase
        .from('users')
        .select('name')
        .eq('id', pair.caregiver_id)
        .maybeSingle();

      const recipientName = recipientProfile?.name || 'Bliska osoba';

      // Compute streak (yesterday backwards)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const ago30 = new Date();
      ago30.setDate(ago30.getDate() - 30);

      const { data: checkins } = await serviceSupabase
        .from('daily_checkins')
        .select('local_date')
        .eq('senior_id', pair.senior_id)
        .gte('local_date', formatDate(ago30))
        .lte('local_date', formatDate(yesterday));

      const dateSet = new Set((checkins || []).map((r: { local_date: string }) => r.local_date));
      let streak = 0;
      for (let i = 1; i <= 30; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        if (dateSet.has(formatDate(d))) streak++;
        else break;
      }

      // Get signaler push tokens
      const { data: devices } = await serviceSupabase
        .from('device_installations')
        .select('push_token')
        .eq('user_id', pair.senior_id)
        .eq('notifications_enabled', true)
        .not('push_token', 'is', null);

      const tokens = (devices || []).map((d) => d.push_token).filter(isExpoPushToken);
      if (tokens.length === 0) continue;

      const messages = tokens.map((token) => ({
        to: token,
        sound: 'default',
        title: 'Cmok',
        body: reminderBody(recipientName, streak),
        data: { type: 'morning_reminder' },
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
