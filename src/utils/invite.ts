import { Share, Platform } from 'react-native';

// TODO: Replace with real App Store / Play Store URLs when published
const APP_STORE_URL = 'https://cmok.app';

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
    | 'first_sign_received_viewed',
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
    `Dołącz do kręgu ${name} w Cmok.`,
    ``,
    `Cmok to prywatna aplikacja dla kręgu bliskich — codzienny znak, że wszystko w porządku.`,
    ``,
    `Twój kod: ${code}`,
    ``,
    `Jeśli masz Cmok, otwórz: ${deepLink}`,
    `Jeśli nie — pobierz: ${APP_STORE_URL}`,
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
    `Pobierz: ${APP_STORE_URL}`,
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
