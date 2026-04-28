import { Alert, Linking, Platform } from 'react-native';

export async function openPhoneCall(phone: string, fallbackMessage?: string): Promise<void> {
  const normalizedPhone = phone.trim();

  if (!normalizedPhone) {
    Alert.alert('Brak numeru', fallbackMessage || 'Nie mamy teraz numeru telefonu do wykonania połączenia.');
    return;
  }

  const url = `tel:${normalizedPhone}`;

  try {
    const canOpen = await Linking.canOpenURL(url);

    if (!canOpen) {
      Alert.alert(
        'Nie można wykonać połączenia',
        fallbackMessage || 'To urządzenie nie obsługuje połączeń telefonicznych.'
      );
      return;
    }

    await Linking.openURL(url);
  } catch {
    Alert.alert(
      'Nie można wykonać połączenia',
      fallbackMessage || 'Nie udało się otworzyć połączenia telefonicznego.'
    );
  }
}

export async function openMapLocation(params: {
  latitude: number;
  longitude: number;
  label?: string;
}): Promise<void> {
  const { latitude, longitude, label } = params;
  const encodedLabel = encodeURIComponent(label || 'Lokalizacja');
  const url = Platform.OS === 'ios'
    ? `https://maps.apple.com/?ll=${latitude},${longitude}&q=${encodedLabel}`
    : `geo:${latitude},${longitude}?q=${latitude},${longitude}(${encodedLabel})`;

  try {
    const canOpen = await Linking.canOpenURL(url);

    if (!canOpen) {
      const webFallback = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
      await Linking.openURL(webFallback);
      return;
    }

    await Linking.openURL(url);
  } catch {
    Alert.alert(
      'Nie można otworzyć mapy',
      'Spróbuj ponownie za chwilę.'
    );
  }
}

/**
 * Open an external URL (https://, mailto:) safely. Bare `Linking.openURL`
 * rejects when the OS can't handle the scheme — historically this surfaced
 * as an unhandled rejection in Sentry (CMOK-9, App Store reviewer's device
 * couldn't open https://cmok.app/polityka-prywatnosci).
 *
 * Always shows a friendly Alert on failure so the user isn't left
 * wondering why nothing happened.
 */
export async function openExternalUrl(url: string, fallbackMessage?: string): Promise<void> {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert(
      'Nie można otworzyć linku',
      fallbackMessage || 'Spróbuj ponownie za chwilę albo otwórz adres ręcznie w przeglądarce.'
    );
  }
}
