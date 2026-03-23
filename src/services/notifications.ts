import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { supabase } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Rejestruje push token i wysyła do Edge Function register-device.
 * Wywoływana przy każdym otwarciu apki.
 * Na web: skip (web push = P2).
 */
export async function registerPushToken(): Promise<string | null> {
  // Web — skip
  if (Platform.OS === 'web') return null;

  // Tylko na fizycznym urządzeniu
  if (!Device.isDevice) {
    console.log('Push notifications wymagają fizycznego urządzenia');
    return null;
  }

  try {
    // Sprawdź / poproś o uprawnienia
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Brak uprawnień do push notifications');
      return null;
    }

    // Pobierz projectId
    const projectId = Constants.expiConfig?.extra?.eas?.projectId;
    if (!projectId) {
      console.log('Brak projectId — push token niedostępny');
      return null;
    }

    // Pobierz token
    const { data: tokenData } = await Notifications.getExpoPushTokenAsync({ projectId });
    const pushToken = tokenData;

    // Android: kanał powiadomień
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Domyślny',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        sound: 'default',
      });

      await Notifications.setNotificationChannelAsync('sos', {
        name: 'SOS Alarm',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 200, 500, 200, 500],
        sound: 'default',
      });
    }

    // Wyślij token do Edge Function register-device
    await registerDeviceOnServer(pushToken);

    return pushToken;
  } catch (err) {
    console.error('registerPushToken error:', err);
    return null;
  }
}

async function registerDeviceOnServer(pushToken: string): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const platform = Platform.OS === 'ios' ? 'ios' : 'android';
    const appVersion = Constants.expiConfig?.version || '1.0.0';

    const response = await fetch(
      `${supabase.supabaseUrl}/functions/v1/register-device`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          platform,
          push_token: pushToken,
          app_version: appVersion,
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error('register-device error:', err);
    }
  } catch (err) {
    console.error('registerDeviceOnServer error:', err);
  }
}
