import { Share, Platform, Alert } from 'react-native';
import { supabase } from '../services/supabase';
import { analytics } from '../services/analytics';

const APP_URL = 'https://cmok.app/pobierz';

/**
 * Minimal invite event logging.
 * In production, this would write to Supabase or analytics.
 * For now: console.log with structured data.
 */
export function logInviteEvent(
  event:
    | 'onboarding_started'
    | 'invite_created'
    | 'invite_shared'
    | 'invite_code_copied'
    | 'join_link_opened'
    | 'invite_join_opened'
    | 'invite_code_submitted'
    | 'invite_join_success'
    | 'join_attempted'
    | 'join_completed'
    | 'invite_resume_started'
    | 'invite_resume_completed'
    | 'invite_resume_failed'
    | 'first_sign_cta_seen'
    | 'first_sign_started'
    | 'first_sign_sent'
    | 'first_sign_success_seen'
    | 'first_sign_received_viewed'
    | 'sender_home_viewed'
    | 'recipient_home_viewed'
    | 'daily_sign_pending_seen'
    | 'daily_sign_completed_seen'
    | 'recipient_waiting_state_seen'
    | 'recipient_sign_seen_today'
    | 'streak_strip_seen'
    | 'second_day_sign_sent'
    | 'third_day_sign_sent'
    | 'sender_nudge_seen'
    | 'sender_recovery_state_seen'
    | 'sender_return_after_gap'
    | 'recipient_waiting_seen_today'
    | 'recipient_gap_waiting_seen'
    | 'reminder_entry_seen'
    | 'sign_sent_after_gap'
    | 'sign_sent_same_day_after_nudge'
    | 'recipient_response_cta_seen'
    | 'recipient_response_started'
    | 'recipient_response_sent'
    | 'recipient_response_success_seen'
    | 'sender_response_seen'
    | 'recipient_response_state_restored'
    | 'recipient_response_duplicate_blocked'
    | 'sender_response_receipt_restored'
    | 'invite_intent_skipped',
  data?: Record<string, string>,
) {
  const timestamp = new Date().toISOString();
  console.log(`[invite] ${event}`, { ...data, timestamp });
}

/**
 * Opens native share sheet with invite for the main connection.
 */
export async function shareInvite(params: {
  code: string;
  signalerLabel?: string | null;
}): Promise<boolean> {
  const { code, signalerLabel } = params;
  const name = signalerLabel || 'bliskiej osoby';

  const message = `Chcę, żebyśmy mieli codzienny cmok. Jeden znak dziennie i spokój dla nas obu.\n\nTwój kod: ${code}\n\nPobierz apkę i wpisz kod:\n${APP_URL}`;

  try {
    const result = await Share.share(
      Platform.OS === 'ios'
        ? { message }
        : { message, title: 'cmok' },
    );

    const shared = result.action === Share.sharedAction;
    if (shared) { logInviteEvent('invite_shared', { code }); analytics.inviteShared('main'); }
    return shared;
  } catch {
    return false;
  }
}

/**
 * Share invite for adding someone to the trusted circle.
 * @deprecated Use generateAndShareInvite() which generates a code first.
 */
export async function shareCircleInvite(): Promise<boolean> {
  const message = [
    `Dołącz do kręgu bliskich w cmok.`,
    ``,
    `cmok to prywatna aplikacja, ktoś bliski chce dodać Cię do swojego kręgu.`,
    `Pobierz: ${APP_URL}`,
  ].join('\n');

  try {
    const result = await Share.share(
      Platform.OS === 'ios'
        ? { message }
        : { message, title: 'Zaproszenie do cmok' },
    );

    const shared = result.action === Share.sharedAction;
    if (shared) logInviteEvent('invite_shared', { type: 'circle' });
    return shared;
  } catch {
    return false;
  }
}

/**
 * Generate a fresh 6-digit invite code, persist it in care_pairs, then
 * open the native share sheet with the code + deep link.
 *
 * Role-aware: detects whether user is signaler (senior_id) or
 * recipient (caregiver_id) and handles both correctly.
 *
 * Returns { code, shared } or null if generation failed.
 */
export async function generateAndShareInvite(): Promise<{ code: string; shared: boolean } | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      Alert.alert('Zaloguj się', 'Żeby zaprosić kogoś, połącz telefon z kontem.');
      return null;
    }

    // Detect role: check if user is a recipient (caregiver) or signaler (senior)
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    const isRecipient = profile?.role === 'recipient' || profile?.role === 'caregiver';

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const col = isRecipient ? 'caregiver_id' : 'senior_id';

    // Guard: don't create a new pending invite if an active relationship already exists
    const { data: activePair } = await supabase
      .from('care_pairs')
      .select('id')
      .eq(col, user.id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    if (activePair) {
      Alert.alert('Już masz połączenie', 'Masz już aktywną relację w cmok. Żeby dodać kogoś do kręgu bliskich, użyj opcji w ustawieniach.');
      return null;
    }

    // Reuse existing pending pair or create new one
    const { data: existing } = await supabase
      .from('care_pairs')
      .select('id')
      .eq(col, user.id)
      .eq('status', 'pending')
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      const { error: updateErr } = await supabase
        .from('care_pairs')
        .update({ invite_code: code, invite_expires_at: expiresAt })
        .eq('id', existing.id);
      if (updateErr) throw updateErr;
    } else {
      const { error: insertErr } = await supabase.from('care_pairs').insert({
        [col]: user.id,
        invite_code: code,
        invite_expires_at: expiresAt,
        status: 'pending',
      });
      if (insertErr) throw insertErr;
    }

    logInviteEvent('invite_created', { code });

    const message = `Chcę, żebyśmy mieli codzienny cmok. Jeden znak dziennie i spokój dla nas obu.\n\nTwój kod: ${code}\n\nPobierz apkę i wpisz kod:\n${APP_URL}`;

    const result = await Share.share(
      Platform.OS === 'ios'
        ? { message }
        : { message, title: 'cmok' },
    );

    const shared = result.action === Share.sharedAction;
    if (shared) { logInviteEvent('invite_shared', { code }); analytics.inviteShared('circle'); }
    return { code, shared };
  } catch (err) {
    console.warn('[invite] generateAndShareInvite error:', err);
    Alert.alert('Nie udało się', 'Spróbuj ponownie za chwilę.');
    return null;
  }
}
