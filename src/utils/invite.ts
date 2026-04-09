import { Share, Platform } from 'react-native';

/**
 * Opens native share sheet with invite text and code.
 * Returns true if shared, false if cancelled/failed.
 */
export async function shareInvite(params: {
  code: string;
  signalerLabel?: string | null;
}): Promise<boolean> {
  const { code, signalerLabel } = params;
  const name = signalerLabel || 'bliskiej osoby';

  const message = [
    `Dołącz do kręgu ${name} w Cmok.`,
    ``,
    `Kod połączenia: ${code}`,
    ``,
    `1. Pobierz Cmok`,
    `2. Utwórz konto`,
    `3. Wpisz kod: ${code}`,
  ].join('\n');

  try {
    const result = await Share.share(
      Platform.OS === 'ios'
        ? { message }
        : { message, title: 'Zaproszenie do Cmok' },
    );

    return result.action === Share.sharedAction;
  } catch {
    return false;
  }
}

/**
 * Share invite for a trusted contact (circle member).
 */
export async function shareCircleInvite(): Promise<boolean> {
  const message = [
    `Dołącz do kręgu bliskich w Cmok.`,
    ``,
    `Cmok to prywatna aplikacja dla kręgu bliskich.`,
    `Pobierz ją i utwórz konto — ktoś bliski doda Cię do swojego kręgu.`,
  ].join('\n');

  try {
    const result = await Share.share(
      Platform.OS === 'ios'
        ? { message }
        : { message, title: 'Zaproszenie do Cmok' },
    );

    return result.action === Share.sharedAction;
  } catch {
    return false;
  }
}
