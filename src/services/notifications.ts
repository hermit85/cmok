import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { supabase, SUPABASE_URL } from './supabase';

type PushRegistrationStatus = 'registered' | 'skipped' | 'unavailable' | 'failed';

export interface PushRegistrationResult {
  status: PushRegistrationStatus;
  pushToken: string | null;
  reason?: string;
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Rejestruje push token i wysyła do Edge Function register-device.
 * Wywoływana przy każdym otwarciu apki.
 * Na web: skip (web push = P2).
 */
export async function registerPushToken(): Promise<PushRegistrationResult> {
  if (Platform.OS === 'web') {
    return { status: 'skipped', pushToken: null, reason: 'web-not-supported' };
  }

  if (!Device.isDevice) {
    return { status: 'skipped', pushToken: null, reason: 'physical-device-required' };
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      await registerDeviceOnServer(null);
      return { status: 'unavailable', pushToken: null, reason: 'permission-denied' };
    }

    if (Platform.OS === 'android') {
      await ensureAndroidChannels();
    }

    const projectId = resolveExpoProjectId();
    if (!projectId) {
      return { status: 'failed', pushToken: null, reason: 'missing-project-id' };
    }

    const { data: tokenData } = await Notifications.getExpoPushTokenAsync({ projectId });
    const pushToken = tokenData;

    if (!isExpoPushToken(pushToken)) {
      return { status: 'failed', pushToken: null, reason: 'invalid-expo-token' };
    }

    await registerDeviceOnServer(pushToken);
    return { status: 'registered', pushToken, reason: 'ok' };
  } catch (err) {
    console.error('registerPushToken error:', err);
    return {
      status: 'failed',
      pushToken: null,
      reason: err instanceof Error ? err.message : 'unknown-register-error',
    };
  }
}

function resolveExpoProjectId(): string | null {
  const projectId =
    Constants.easConfig?.projectId ||
    Constants.expoConfig?.extra?.eas?.projectId ||
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID ||
    null;

  return projectId || null;
}

function isExpoPushToken(value: string | null | undefined): value is string {
  if (!value) return false;
  return value.startsWith('ExponentPushToken[') || value.startsWith('ExpoPushToken[');
}

async function ensureAndroidChannels(): Promise<void> {
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Domyślne',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    sound: 'default',
  });

  await Notifications.setNotificationChannelAsync('sos', {
    name: 'Ważne wiadomości',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 500, 200, 500, 200, 500],
    sound: 'default',
  });
}

async function registerDeviceOnServer(pushToken: string | null): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const platform = Platform.OS === 'ios' ? 'ios' : 'android';
    const appVersion = Constants.expoConfig?.version || '1.0.0';

    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/register-device`,
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
      const text = await response.text();
      throw new Error(text || 'register-device failed');
    }
  } catch (err) {
    console.error('registerDeviceOnServer error:', err);
    throw err;
  }
}
