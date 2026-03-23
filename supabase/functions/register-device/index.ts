// ============================================================
// Cmok — register-device Edge Function
// Rejestruje/odświeża push token urządzenia.
// Wywoływana przy każdym otwarciu apki.
// ============================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  // Tylko POST
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Brak tokenu autoryzacji' }), { status: 401 });
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
      return new Response(JSON.stringify({ error: 'Nieautoryzowany' }), { status: 401 });
    }

    const body = await req.json();
    const { platform, push_token, app_version } = body;

    if (!platform || !['android', 'ios'].includes(platform)) {
      return new Response(JSON.stringify({ error: 'Nieprawidłowa platforma' }), { status: 400 });
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
      return new Response(JSON.stringify({ error: upsertError.message }), { status: 500 });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
