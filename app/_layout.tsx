import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_700Bold } from '@expo-google-fonts/inter';
import { Nunito_500Medium, Nunito_600SemiBold, Nunito_700Bold } from '@expo-google-fonts/nunito';
import { PostHogProvider } from 'posthog-react-native';
import { registerPushToken } from '../src/services/notifications';
import { supabase } from '../src/services/supabase';
import { posthog } from '../src/services/posthog';
import { Colors } from '../src/constants/colors';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_700Bold,
    Nunito_500Medium,
    Nunito_600SemiBold,
    Nunito_700Bold,
  });

  // Capture JS errors in PostHog
  useEffect(() => {
    const prevHandler = ErrorUtils.getGlobalHandler();
    ErrorUtils.setGlobalHandler((error, isFatal) => {
      posthog.capture('$exception', {
        $exception_message: error?.message || String(error),
        $exception_stack_trace_raw: error?.stack || '',
        $exception_is_fatal: isFatal ?? false,
      });
      prevHandler?.(error, isFatal);
    });
  }, []);

  // Rejestruj push token przy uruchomieniu + po zalogowaniu
  // Identify user in PostHog after auth
  useEffect(() => {
    const tryRegister = () => {
      registerPushToken()
        .then((result) => {
          if (result.status !== 'registered') {
            console.log(`Push registration: ${result.status}`, result.reason || 'no-reason');
          }
        })
        .catch((err) => console.log('Push token registration failed:', err));
    };

    tryRegister(); // On mount

    // Re-register after login + identify in PostHog
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') {
        tryRegister();
        if (session?.user?.id) {
          posthog.identify(session.user.id, { phone: session.user.phone ?? '' });
        }
      }
      if (event === 'SIGNED_OUT') {
        posthog.reset();
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  return (
    <PostHogProvider client={posthog}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: Colors.background },
            animation: 'fade_from_bottom',
          }}
        />
      </SafeAreaProvider>
    </PostHogProvider>
  );
}
