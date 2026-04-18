// ============================================================
// cmok · reset-test-data Edge Function
// Czyści dane testowe, seeduje konta, lub konfiguruje pod Apple review.
// Użycie: POST z body { mode: "..." } + header x-reset-secret: <SECRET>
//   keep_pair — czyści checkins/signals/alerts, zostawia relację
//   full_reset — czyści wszystko, wraca do stanu pre-onboarding
//   seed_sasiad — tworzy konto Sąsiada jeśli nie istnieje (signaler)
//   seed_invite — tworzy pending pair z invite_code 111222 dla recipienta
//   seed_apple_review — pełna konfiguracja dla Apple reviewera:
//     - naprawia nazwy (Mama/Darek/Sąsiad)
//     - aktywna para Mama↔Darek
//     - dzisiejszy check-in od Mamy (status: good)
//     - backup invite code 111222 dla testowania onboardingu
// ============================================================
//
// Auth: requires header `x-reset-secret: <RESET_TEST_SECRET>`.
// Without the env var configured, function refuses every call (503).
//
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Live test account phones. Updated 2026-04-18 — previously this file
// referenced the legacy 100000xxx numbers; actual seed data uses 500000xxx.
const TEST_PHONE_MAMA = '48500000001';
const TEST_PHONE_DAREK = '48500000002';
const TEST_PHONE_SASIAD = '48500000003';
const TEST_PHONES = [TEST_PHONE_MAMA, TEST_PHONE_DAREK, TEST_PHONE_SASIAD];

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-reset-secret',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  // Gate: require shared secret header. If RESET_TEST_SECRET is unset,
  // refuse to run at all so an empty env doesn't accidentally open the door.
  const expectedSecret = Deno.env.get('RESET_TEST_SECRET');
  if (!expectedSecret) {
    return jsonResponse({ error: 'reset-test-data not configured (missing RESET_TEST_SECRET)' }, 503);
  }
  const providedSecret = req.headers.get('x-reset-secret');
  if (!providedSecret || providedSecret !== expectedSecret) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const serviceSupabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    let mode = 'keep_pair';
    try {
      const body = await req.json();
      mode = body.mode || 'keep_pair';
    } catch { /* default to keep_pair */ }

    // seed_apple_review: full setup for App Store reviewer
    if (mode === 'seed_apple_review') {
      const steps: string[] = [];

      // 1. Find users
      const { data: allUsers } = await serviceSupabase
        .from('users')
        .select('id, phone')
        .in('phone', TEST_PHONES);

      const mama = allUsers?.find(u => u.phone === TEST_PHONE_MAMA);
      const darek = allUsers?.find(u => u.phone === TEST_PHONE_DAREK);

      if (!mama || !darek) {
        return jsonResponse({ error: 'Test users not found — log in as 001 and 002 first' }, 404);
      }

      // 2. Fix names
      await serviceSupabase.from('users').update({ name: 'Mama' }).eq('id', mama.id);
      await serviceSupabase.from('users').update({ name: 'Darek' }).eq('id', darek.id);
      steps.push('names: Mama + Darek');

      // 3. Clean slate: remove pairs involving these users
      await serviceSupabase.from('care_pairs').delete()
        .or(`senior_id.eq.${mama.id},caregiver_id.eq.${mama.id},senior_id.eq.${darek.id},caregiver_id.eq.${darek.id}`);

      // 4. Create active pair
      const { data: activePair, error: pairErr } = await serviceSupabase
        .from('care_pairs')
        .insert({
          senior_id: mama.id,
          caregiver_id: darek.id,
          status: 'active',
          signaler_label: 'Mama',
          senior_name: 'Mama',
          joined_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .select()
        .single();

      if (pairErr) return jsonResponse({ error: `active pair: ${pairErr.message}` }, 500);
      steps.push(`active_pair: ${activePair.id}`);

      // 5. Today's check-in from Mama (so Darek sees "sign received")
      const today = new Date().toISOString().slice(0, 10);
      await serviceSupabase
        .from('daily_checkins')
        .delete()
        .eq('senior_id', mama.id)
        .eq('local_date', today);

      await serviceSupabase.from('daily_checkins').insert({
        senior_id: mama.id,
        local_date: today,
        checked_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        source: 'app',
        status_emoji: 'good',
      });
      steps.push('today_checkin: good');

      return jsonResponse({
        ok: true,
        mode,
        steps,
        credentials: {
          signaler: { phone: '+48 500 000 001', otp: '123456', name: 'Mama' },
          recipient: { phone: '+48 500 000 002', otp: '123456', name: 'Darek' },
          note: 'Log in with either number, will land directly on home screen with active pair and today sign',
        },
      });
    }

    // seed_invite: create pending pair with invite_code 111222 for recipient testing
    if (mode === 'seed_invite') {
      const { data: darek } = await serviceSupabase
        .from('users')
        .select('id')
        .eq('phone', TEST_PHONE_DAREK)
        .maybeSingle();

      if (!darek) {
        return jsonResponse({ error: `Recipient account (${TEST_PHONE_DAREK}) not found` }, 404);
      }

      // Remove any existing pending pair for Darek to avoid conflict
      await serviceSupabase
        .from('care_pairs')
        .delete()
        .eq('caregiver_id', darek.id)
        .eq('status', 'pending');

      const { data: pair, error: pairErr } = await serviceSupabase
        .from('care_pairs')
        .insert({
          caregiver_id: darek.id,
          invite_code: '111222',
          invite_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'pending',
          signaler_label: 'Mama',
          senior_name: 'Mama',
        })
        .select()
        .single();

      if (pairErr) {
        return jsonResponse({ error: `seed_invite failed: ${pairErr.message}` }, 500);
      }

      return jsonResponse({ ok: true, mode, invite_code: '111222', pair_id: pair.id });
    }

    // seed_sasiad: create auth+profile for sąsiad test account if missing
    if (mode === 'seed_sasiad') {
      const { data: existing } = await serviceSupabase
        .from('users')
        .select('id')
        .eq('phone', TEST_PHONE_SASIAD)
        .maybeSingle();

      if (existing) {
        return jsonResponse({ ok: true, mode, note: 'already exists' });
      }

      const { data: authUser, error: authErr } = await serviceSupabase.auth.admin.createUser({
        phone: TEST_PHONE_SASIAD,
        phone_confirm: true,
      });
      if (authErr || !authUser?.user) {
        return jsonResponse({ error: `auth create failed: ${authErr?.message}` }, 500);
      }

      const { error: profileErr } = await serviceSupabase.from('users').insert({
        id: authUser.user.id,
        phone: TEST_PHONE_SASIAD,
        name: 'Sąsiad',
        role: 'signaler',
      });
      if (profileErr) {
        return jsonResponse({ error: `profile insert failed: ${profileErr.message}` }, 500);
      }

      return jsonResponse({ ok: true, mode, created: authUser.user.id });
    }

    // 1. Find test user IDs
    const { data: users } = await serviceSupabase
      .from('users')
      .select('id, phone, name')
      .in('phone', TEST_PHONES);

    if (!users || users.length === 0) {
      return jsonResponse({ error: 'Test accounts not found' }, 404);
    }

    const userIds = users.map(u => u.id);
    const deleted: string[] = [];

    // 2. Delete signals (sent and received by test users)
    const { count: sigCount } = await serviceSupabase
      .from('signals')
      .delete({ count: 'exact' })
      .or(userIds.map(id => `from_user_id.eq.${id}`).join(',') + ',' + userIds.map(id => `to_user_id.eq.${id}`).join(','));
    deleted.push(`signals: ${sigCount || 0}`);

    // 3. Delete daily checkins
    const { count: checkinCount } = await serviceSupabase
      .from('daily_checkins')
      .delete({ count: 'exact' })
      .in('senior_id', userIds);
    deleted.push(`daily_checkins: ${checkinCount || 0}`);

    // 4. Delete alert deliveries (for alerts by test users)
    const { data: alerts } = await serviceSupabase
      .from('alert_cases')
      .select('id')
      .in('senior_id', userIds);
    const alertIds = (alerts || []).map(a => a.id);
    if (alertIds.length > 0) {
      const { count: delCount } = await serviceSupabase
        .from('alert_deliveries')
        .delete({ count: 'exact' })
        .in('alert_case_id', alertIds);
      deleted.push(`alert_deliveries: ${delCount || 0}`);
    }

    // 5. Delete alert cases
    const { count: alertCount } = await serviceSupabase
      .from('alert_cases')
      .delete({ count: 'exact' })
      .in('senior_id', userIds);
    deleted.push(`alert_cases: ${alertCount || 0}`);

    // 6. Delete trusted contacts (added by or for test users)
    const { data: pairs } = await serviceSupabase
      .from('care_pairs')
      .select('id')
      .or(userIds.map(id => `senior_id.eq.${id}`).join(',') + ',' + userIds.map(id => `caregiver_id.eq.${id}`).join(','));
    const pairIds = (pairs || []).map(p => p.id);
    if (pairIds.length > 0) {
      const { count: tcCount } = await serviceSupabase
        .from('trusted_contacts')
        .delete({ count: 'exact' })
        .in('relationship_id', pairIds);
      deleted.push(`trusted_contacts: ${tcCount || 0}`);
    }

    // 7. Delete device installations
    const { count: deviceCount } = await serviceSupabase
      .from('device_installations')
      .delete({ count: 'exact' })
      .in('user_id', userIds);
    deleted.push(`device_installations: ${deviceCount || 0}`);

    if (mode === 'full_reset') {
      // 8. Delete care_pairs
      const { count: pairCount } = await serviceSupabase
        .from('care_pairs')
        .delete({ count: 'exact' })
        .or(userIds.map(id => `senior_id.eq.${id}`).join(',') + ',' + userIds.map(id => `caregiver_id.eq.${id}`).join(','));
      deleted.push(`care_pairs: ${pairCount || 0}`);

      // 9. Delete user profiles
      const { count: userCount } = await serviceSupabase
        .from('users')
        .delete({ count: 'exact' })
        .in('id', userIds);
      deleted.push(`users: ${userCount || 0}`);

      // 10. Delete auth users
      for (const id of userIds) {
        await serviceSupabase.auth.admin.deleteUser(id);
      }
      deleted.push(`auth_users: ${userIds.length}`);
    } else {
      // keep_pair: just reset names to known good state
      await serviceSupabase.from('users').update({ name: 'Mama' }).eq('phone', TEST_PHONE_MAMA);
      await serviceSupabase.from('users').update({ name: 'Darek' }).eq('phone', TEST_PHONE_DAREK);
      await serviceSupabase.from('users').update({ name: 'Sąsiad' }).eq('phone', TEST_PHONE_SASIAD);

      // Reset pair labels
      if (pairIds.length > 0) {
        await serviceSupabase.from('care_pairs')
          .update({ signaler_label: 'Mama', senior_name: 'Mama' })
          .in('id', pairIds);
      }
      deleted.push('names_reset: Mama + Darek + Sąsiad');
    }

    return jsonResponse({ ok: true, mode, deleted });
  } catch (error) {
    return jsonResponse({ error: String(error) }, 500);
  }
});

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS_HEADERS });
}
