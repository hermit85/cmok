// ============================================================
// Cmok — delete-account Edge Function
// Trwale usuwa wszystkie dane użytkownika (GDPR/App Store compliance).
// ============================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonResponse({ error: 'Missing authorization' }, 401);
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
    const userId = user.id;

    // 1. Delete signals (sent and received)
    await serviceSupabase.from('signals').delete().or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`);

    // 2. Delete daily checkins
    await serviceSupabase.from('daily_checkins').delete().eq('senior_id', userId);

    // 3. Delete trusted contacts (as member)
    await serviceSupabase.from('trusted_contacts').delete().eq('user_id', userId);

    // 4. Delete alert deliveries (as recipient)
    await serviceSupabase.from('alert_deliveries').delete().eq('recipient_id', userId);

    // 5. Delete alert cases (as senior)
    await serviceSupabase.from('alert_cases').delete().eq('senior_id', userId);

    // 6. Delete care pairs (as either side)
    await serviceSupabase.from('care_pairs').delete().or(`senior_id.eq.${userId},caregiver_id.eq.${userId}`);

    // 7. Delete device installations
    await serviceSupabase.from('device_installations').delete().eq('user_id', userId);

    // 8. Delete user profile
    await serviceSupabase.from('users').delete().eq('id', userId);

    // 9. Delete auth user (removes from auth.users)
    await serviceSupabase.auth.admin.deleteUser(userId);

    return jsonResponse({ ok: true, deleted: userId });
  } catch (error) {
    return jsonResponse({ error: String(error) }, 500);
  }
});

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS_HEADERS });
}
