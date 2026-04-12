import { Share, Platform } from 'react-native';

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
 * Includes deep link: cmok://join/{code}
 */
export async function shareInvite(params: {
  code: string;
  signalerLabel?: string | null;
}): Promise<boolean> {
  const { code, signalerLabel } = params;
  const name = signalerLabel || 'bliskiej osoby';
  const deepLink = `cmok://join/${code}`;

  const message = [
    `Dołącz do mojego kręgu w Cmok!`,
    `Twój kod: ${code}`,
    ``,
    `Pobierz apkę: ${APP_URL}`,
    ``,
    `Masz już Cmok? Otwórz: ${deepLink}`,
  ].join('\n');

  try {
    const result = await Share.share(
      Platform.OS === 'ios'
        ? { message }
        : { message, title: 'Zaproszenie do Cmok' },
    );

    const shared = result.action === Share.sharedAction;
    if (shared) logInviteEvent('invite_shared', { code });
    return shared;
  } catch {
    return false;
  }
}

/**
 * Share invite for adding someone to the trusted circle.
 */
export async function shareCircleInvite(): Promise<boolean> {
  const message = [
    `Dołącz do kręgu bliskich w Cmok.`,
    ``,
    `Cmok to prywatna aplikacja — ktoś bliski chce dodać Cię do swojego kręgu.`,
    `Pobierz: ${APP_URL}`,
  ].join('\n');

  try {
    const result = await Share.share(
      Platform.OS === 'ios'
        ? { message }
        : { message, title: 'Zaproszenie do Cmok' },
    );

    const shared = result.action === Share.sharedAction;
    if (shared) logInviteEvent('invite_shared', { type: 'circle' });
    return shared;
  } catch {
    return false;
  }
}
