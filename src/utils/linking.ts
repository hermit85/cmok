import { Alert, Linking } from 'react-native';

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

