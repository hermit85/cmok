// ============================================================
// cmok · reaction-notify Edge Function
// Wysyła push do signalera gdy recipient odpowie gestem (reakcją).
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

const EMOJI_LABELS: Record<string, string> = {
  '\u{2764}\u{FE0F}': 'Kocham',
  '\u{1F31B}': 'Dobranoc',
  '\u{1F44D}': 'OK!',
  '\u{1F31E}': 'Super!',
};

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

  let toUserId: string | undefined;
  let emoji: string | undefined;
  try {
    const body = await req.json();
    toUserId = body.to_user_id;
    emoji = body.emoji;
  } catch {
    // body is optional for backwards compat, will look up from relationship
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
    // 1. Sender's (recipient's) name
    const { data: profile } = await serviceSupabase
      .from('users')
      .select('name')
      .eq('id', user.id)
      .maybeSingle();

    const senderName = profile?.name || 'Bliska osoba';

    // 2. Resolve the signaler to notify — derive from active care_pair.
    // Never trust toUserId from client without checking the pair exists.
    let signalerIds: string[] = [];
    {
      const { data: pair } = await serviceSupabase
        .from('care_pairs')
        .select('senior_id')
        .eq('caregiver_id', user.id)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();
      if (pair?.senior_id) {
        // If client passed toUserId, it must match the actual signaler in the pair.
        if (toUserId && toUserId !== pair.senior_id) {
          return jsonResponse({ error: 'Forbidden' }, 403);
        }
        signalerIds = [pair.senior_id];
      } else if (toUserId) {
        // Client passed toUserId but caller has no active pair — reject.
        return jsonResponse({ error: 'Forbidden' }, 403);
      }
    }

    if (signalerIds.length === 0) {
      return jsonResponse({ ok: true, skipped: 'no_signaler' });
    }

    // 3. Get push tokens for the signaler(s)
    const { data: devices } = await serviceSupabase
      .from('device_installations')
      .select('push_token')
      .in('user_id', signalerIds)
      .eq('notifications_enabled', true)
      .not('push_token', 'is', null);

    const tokens = (devices || [])
      .map((d) => d.push_token)
      .filter(isExpoPushToken);

    if (tokens.length === 0) {
      return jsonResponse({ ok: true, skipped: 'no_push_tokens' });
    }

    // 4. Build warm push message
    const emojiLabel = emoji ? EMOJI_LABELS[emoji] || '' : '';
    const body = emojiLabel
      ? `${senderName} odpowiada: ${emojiLabel}`
      : `${senderName} jest z Tobą`;

    const messages = tokens.map((token) => ({
      to: token,
      sound: 'default',
      title: 'cmok',
      body,
      data: { type: 'reaction', from_user_id: user.id },
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

    return jsonResponse({ ok: true, sent: response.ok, body });
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
