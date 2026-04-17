// ============================================================
// cmok · poke-notify Edge Function
// Push notification when someone sends a standalone poke gesture.
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

const POKE_LABELS: Record<string, string> = {
  // Moods (signaler sends)
  '\u{1F60A}': 'Dobrze',
  '\u{1F60C}': 'Spokojnie',
  '\u{1F634}': 'Zm\u{0119}czona',
  '\u{1FA7A}': 'U lekarza',
  // Reactions (recipient sends)
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

  const userSupabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const serviceSupabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Auth first — reject invalid JWT before touching body or DB.
  const {
    data: { user },
    error: authError,
  } = await userSupabase.auth.getUser();

  if (authError || !user) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  let toUserId: string | undefined;
  let emoji: string | undefined;
  try {
    const body = await req.json();
    toUserId = body.to_user_id;
    emoji = body.emoji;
  } catch {
    return jsonResponse({ error: 'Invalid body' }, 400);
  }

  if (!toUserId) {
    return jsonResponse({ error: 'to_user_id required' }, 400);
  }

  try {
    // AUTHZ: caller can only poke users with whom they share an active relationship.
    // Prevents authenticated push-spam to arbitrary user_ids.
    const { data: pairs } = await serviceSupabase
      .from('care_pairs')
      .select('senior_id, caregiver_id')
      .or(`and(senior_id.eq.${user.id},caregiver_id.eq.${toUserId}),and(senior_id.eq.${toUserId},caregiver_id.eq.${user.id})`)
      .eq('status', 'active')
      .limit(1);

    let isAllowed = (pairs || []).length > 0;
    if (!isAllowed) {
      // Allow when caller is a trusted contact of toUserId's relationship, or vice versa.
      const { data: trustedShared } = await serviceSupabase
        .from('trusted_contacts')
        .select('relationship_id, user_id, care_pairs!inner(senior_id, caregiver_id, status)')
        .in('user_id', [user.id, toUserId])
        .eq('status', 'active')
        .eq('care_pairs.status', 'active');
      for (const row of (trustedShared || [])) {
        const pair = Array.isArray((row as any).care_pairs) ? (row as any).care_pairs[0] : (row as any).care_pairs;
        if (!pair) continue;
        const pairMembers = [pair.senior_id, pair.caregiver_id];
        if (pairMembers.includes(user.id) || pairMembers.includes(toUserId)) {
          isAllowed = true;
          break;
        }
      }
    }
    if (!isAllowed) {
      return jsonResponse({ error: 'Forbidden' }, 403);
    }

    const { data: profile } = await serviceSupabase
      .from('users')
      .select('name')
      .eq('id', user.id)
      .maybeSingle();

    const senderName = profile?.name || 'Bliska osoba';

    const { data: devices } = await serviceSupabase
      .from('device_installations')
      .select('push_token')
      .eq('user_id', toUserId)
      .eq('notifications_enabled', true)
      .not('push_token', 'is', null);

    const tokens = (devices || [])
      .map((d) => d.push_token)
      .filter(isExpoPushToken);

    if (tokens.length === 0) {
      return jsonResponse({ ok: true, skipped: 'no_push_tokens' });
    }

    const emojiLabel = emoji ? POKE_LABELS[emoji] || '' : '';
    const body = emojiLabel
      ? `${senderName}: ${emojiLabel}`
      : `${senderName} my\u{015B}li o Tobie`;

    const messages = tokens.map((token) => ({
      to: token,
      sound: 'default',
      title: 'cmok',
      body,
      data: { type: 'poke', from_user_id: user.id },
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
