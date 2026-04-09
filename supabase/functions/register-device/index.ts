// ============================================================
// Cmok — register-device Edge Function
// Rejestruje/odświeża push token urządzenia.
// Wywoływana przy każdym otwarciu apki.
// ============================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function isExpoPushToken(value: string | null | undefined): boolean {
  if (!value) return false;
  return value.startsWith('ExponentPushToken[') || value.startsWith('ExpoPushToken[');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: CORS_HEADERS });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Brak tokenu autoryzacji' }), { status: 401, headers: CORS_HEADERS });
    }

    // Klient z tokenem usera (żeby RLS działał)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Pobierz user_id z JWT
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Nieautoryzowany' }), { status: 401, headers: CORS_HEADERS });
    }

    const body = await req.json();
    const { platform, push_token, app_version } = body;

    if (!platform || !['android', 'ios'].includes(platform)) {
      return new Response(JSON.stringify({ error: 'Nieprawidłowa platforma' }), { status: 400, headers: CORS_HEADERS });
    }

    if (push_token && !isExpoPushToken(push_token)) {
      return new Response(JSON.stringify({ error: 'Nieprawidłowy Expo push token' }), { status: 400, headers: CORS_HEADERS });
    }

    // UPSERT — service role do omijania RLS
    const serviceSupabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { error: upsertError } = await serviceSupabase
      .from('device_installations')
      .upsert(
        {
          user_id: user.id,
          platform,
          push_token: push_token || null,
          app_version: app_version || null,
          last_seen_at: new Date().toISOString(),
          notifications_enabled: !!push_token,
        },
        { onConflict: 'user_id,platform' }
      );

    if (upsertError) {
      return new Response(JSON.stringify({ error: upsertError.message }), { status: 500, headers: CORS_HEADERS });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: CORS_HEADERS,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: CORS_HEADERS });
  }
});
