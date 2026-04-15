import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: 'https://e6321695761306adb4e11ad092aba048@o4511067380711424.ingest.de.sentry.io/4511220189691985',
  tracesSampleRate: 1.0,
  enableNativeCrashHandling: true,
  enableAutoSessionTracking: true,
});
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_700Bold } from '@expo-google-fonts/inter';
import { Nunito_500Medium, Nunito_600SemiBold, Nunito_700Bold } from '@expo-google-fonts/nunito';
import { PostHogProvider } from 'posthog-react-native';
import { registerPushToken } from '../src/services/notifications';
import { supabase } from '../src/services/supabase';
import { posthog } from '../src/services/posthog';
import { Colors } from '../src/constants/colors';

function RootLayout() {
  const router = useRouter();
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
      try {
        posthog.capture('$exception', {
          $exception_message: error?.message || String(error),
          $exception_stack_trace_raw: error?.stack || '',
          $exception_is_fatal: isFatal ?? false,
        });
      } finally {
        prevHandler?.(error, isFatal);
      }
    });
  }, []);

  // Handle push notification tap — navigate based on role + trusted access
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(async (response) => {
      const data = response.notification.request.content.data;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) { router.replace('/onboarding'); return; }

        const { data: profile } = await supabase.from('users').select('role').eq('id', session.user.id).maybeSingle();
        const role = profile?.role;

        // Check trusted-contact access for SOS routing
        // Uses alert_cases → care_pairs → trusted_contacts to determine role precisely.
        if (data?.type === 'sos' || data?.type === 'missed_checkin') {
          if (data?.alert_id) {
            const { data: alert } = await supabase
              .from('alert_cases')
              .select('senior_id')
              .eq('id', data.alert_id)
              .maybeSingle();

            if (alert) {
              // User is the signaler who triggered SOS
              if (alert.senior_id === session.user.id) {
                router.replace('/signaler-home'); return;
              }
              // Check the care_pair for this alert
              const { data: pair } = await supabase
                .from('care_pairs')
                .select('id, caregiver_id')
                .eq('senior_id', alert.senior_id)
                .eq('status', 'active')
                .maybeSingle();

              if (pair) {
                // User is the primary recipient
                if (pair.caregiver_id === session.user.id) {
                  router.replace('/recipient-home'); return;
                }
                // Check if user is a trusted contact for this relationship
                const { data: tc } = await supabase
                  .from('trusted_contacts')
                  .select('id')
                  .eq('relationship_id', pair.id)
                  .eq('user_id', session.user.id)
                  .eq('status', 'active')
                  .maybeSingle();
                if (tc) {
                  router.replace('/trusted-support'); return;
                }
              }
            }
          }
          // Fallback: route by role
          if (role === 'signaler') { router.replace('/signaler-home'); return; }
          if (role === 'recipient') { router.replace('/recipient-home'); return; }
          router.replace('/onboarding');
          return;
        }

        if (data?.type === 'daily_checkin') { router.replace('/recipient-home'); return; }
        if (data?.type === 'nudge') { router.replace('/signaler-home'); return; }

        // Default: route by role
        router.replace(role === 'signaler' ? '/signaler-home' : role === 'recipient' ? '/recipient-home' : '/onboarding');
      } catch {
        // Network error during push handling — just go to index which will route correctly
        router.replace('/');
      }
    });
    return () => sub.remove();
  }, [router]);

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

export default Sentry.wrap(RootLayout);
