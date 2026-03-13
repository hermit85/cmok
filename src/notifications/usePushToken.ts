import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export function usePushToken() {
  const [expoPushToken, setExpoPushToken] = useState<string>('');
  const [deviceId, setDeviceId] = useState<string>('');

  useEffect(() => {
    // Get device ID
    const id = Device.modelId ?? Device.deviceName ?? `device-${Date.now()}`;
    setDeviceId(id);

    // Register for push notifications
    registerForPushNotificationsAsync().then((token) => {
      if (token) setExpoPushToken(token);
    });
  }, []);

  return { expoPushToken, deviceId };
}

async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Push notification permission not granted');
      return null;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      console.log('No projectId found — push tokens unavailable in Expo Go. Use a development build.');
      return null;
    }

    const token = await Notifications.getExpoPushTokenAsync({ projectId });

    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
      });
    }

    return token.data;
  } catch (error) {
    console.log('Push notification registration failed:', error);
    return null;
  }
}
