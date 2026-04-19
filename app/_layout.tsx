import { useEffect, useRef } from 'react';
import { View, ActivityIndicator, AppState, Platform } from 'react-native';
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
import {
  requestTrackingPermissionsAsync,
  getTrackingPermissionsAsync,
} from 'expo-tracking-transparency';
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

  // App Tracking Transparency prompt — shown once on first launch.
  // Required by Apple when the app includes analytics SDKs, even if they
  // don't use IDFA (reviewers check for ATT presence). Runs only on iOS,
  // only when status is 'undetermined'. Runs after a short delay so the
  // welcome screen renders first and the prompt doesn't feel jarring.
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (cancelled) return;
      try {
        const { status } = await getTrackingPermissionsAsync();
        if (status === 'undetermined') {
          await requestTrackingPermissionsAsync();
        }
      } catch {
        // prompt unavailable (older iOS / simulator) — ignore silently
      }
    }, 1500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

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

  // Rejestruj push token przy uruchomieniu + po zalogowaniu + po wznowieniu
  // Identify user in PostHog after auth
  const lastPushRegisterRef = useRef(0);
  useEffect(() => {
    const PUSH_REGISTER_THROTTLE_MS = 30_000;

    // Server-side validation before registering: getUser() hits the server
    // and fails if the cached JWT is revoked / account deleted. Without this
    // a stale session would silently 401 inside register-device.
    const tryRegister = async (reason: string) => {
      const now = Date.now();
      if (now - lastPushRegisterRef.current < PUSH_REGISTER_THROTTLE_MS) return;
      lastPushRegisterRef.current = now;
      try {
        const { data: { user }, error: userErr } = await supabase.auth.getUser();
        if (userErr || !user) {
          // Session dead or not hydrated yet; we'll be called again on
          // SIGNED_IN / INITIAL_SESSION / TOKEN_REFRESHED.
          lastPushRegisterRef.current = 0;
          return;
        }
        const result = await registerPushToken();
        if (result.status !== 'registered') {
          Sentry.captureMessage(`push_register_${result.status}`, {
            level: 'warning',
            extra: { reason, detail: result.reason || null },
          });
        }
      } catch (err) {
        Sentry.captureException(err, { extra: { context: 'push_register', reason } });
      }
    };

    // Auth state change catches all hydration paths:
    //   - INITIAL_SESSION: cold start after restart (cached session restored)
    //   - SIGNED_IN:       fresh login via SMS
    //   - TOKEN_REFRESHED: long-lived session refresh
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
        if (session?.user) {
          tryRegister(event.toLowerCase());
          // Identify by user id only. We deliberately do NOT send phone to
          // PostHog — phone is PII declared in PrivacyInfo.xcprivacy as
          // App Functionality purpose, not Analytics. Keeping phone out of
          // PostHog keeps the privacy declaration honest and reduces the
          // blast radius if the PostHog project is ever compromised.
          posthog.identify(session.user.id);
        }
      }
      if (event === 'SIGNED_OUT') {
        posthog.reset();
      }
    });

    // Re-register on app foreground (handles permission flips + rotated tokens)
    const appStateSub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      tryRegister('foreground');
    });

    return () => {
      subscription.unsubscribe();
      appStateSub.remove();
    };
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
