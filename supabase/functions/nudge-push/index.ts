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
    // 1. Get recipient (caller) name
    const { data: profile } = await serviceSupabase
      .from('users')
      .select('id, name')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile) {
      return jsonResponse({ error: 'User not found' }, 404);
    }

    // 2. Find active relationship → signaler
    const { data: pair } = await serviceSupabase
      .from('care_pairs')
      .select('id, senior_id')
      .eq('caregiver_id', user.id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    if (!pair || !pair.senior_id) {
      return jsonResponse({ ok: true, skipped: 'no_relationship' });
    }

    // 3. Dedup: check if nudge already sent today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: existing } = await serviceSupabase
      .from('signals')
      .select('id')
      .eq('from_user_id', user.id)
      .eq('to_user_id', pair.senior_id)
      .eq('type', 'nudge')
      .gte('created_at', todayStart.toISOString())
      .limit(1)
      .maybeSingle();

    if (existing) {
      return jsonResponse({ ok: true, skipped: 'already_sent' });
    }

    // 4. Get signaler's push tokens
    const { data: devices } = await serviceSupabase
      .from('device_installations')
      .select('push_token')
      .eq('user_id', pair.senior_id)
      .eq('notifications_enabled', true)
      .not('push_token', 'is', null);

    const tokens = (devices || [])
      .map((d) => d.push_token)
      .filter(isExpoPushToken);

    if (tokens.length === 0) {
      return jsonResponse({ ok: true, skipped: 'no_tokens' });
    }

    // 5. Send push
    const recipientName = profile.name || 'Bliska osoba';
    const messages = tokens.map((token) => ({
      to: token,
      sound: 'default',
      title: 'Cmok',
      body: `${recipientName} czeka na Twój znak 💚`,
      data: { type: 'nudge' },
      priority: 'normal',
      channelId: 'default',
    }));

    const pushResponse = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    const sent = pushResponse.ok;
    return jsonResponse({ ok: true, sent, tokens: tokens.length });
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
