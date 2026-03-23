import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { registerPushToken } from '../src/services/notifications';

export default function RootLayout() {
  // Rejestruj push token przy każdym uruchomieniu apki
  useEffect(() => {
    registerPushToken().catch((err) =>
      console.log('Push token registration skipped:', err)
    );
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#FFFFFF' },
          animation: 'fade_from_bottom',
        }}
      />
    </SafeAreaProvider>
  );
}
