import { useEffect, useRef } from 'react';
import { View, ActivityIndicator, AppState, Platform, LogBox } from 'react-native';

// Maestro E2E: suppress dev LogBox toast so it doesn't overlay bottom UI
// (e.g. SOS button) and intercept tap events. No-op in production builds.
if (__DEV__ && process.env.EXPO_PUBLIC_DISABLE_LOGBOX === '1') {
  LogBox.ignoreAllLogs(true);
}
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
import { prefetchRelationship } from '../src/hooks/useRelationship';
import { prefetchCircle } from '../src/hooks/useCircle';
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

  // App Tracking Transparency intentionally NOT requested.
  // cmok's PostHog usage is product analytics only — no IDFA access, no
  // cross-app tracking, no data broker sharing. Under Apple's rules
  // (ATT is required ONLY for cross-app/IDFA tracking), we shouldn't
  // prompt. Shipping the prompt while the privacy manifest declares
  // NSPrivacyTracking=false triggered an App Store review inconsistency
  // flag (2026-04-19). Removed both plugin + Info.plist permission +
  // runtime prompt. If we ever add cross-app tracking later, re-enable
  // intentionally rather than as a "just in case".

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

  // Handle push notification tap — navigate based on role.
  //
  // Past versions made up to 4 sequential queries (users → alert_cases →
  // care_pairs → trusted_contacts) BEFORE navigating. On cold start this
  // meant the user stared at a blank screen for 500–1500 ms after tapping
  // a push. Now we navigate by role on a single query (users.role) and
  // refine to /trusted-support in the background only when the alert
  // belongs to a different pair than the user's primary role. The home
  // screens already render the SOS state via useUrgentSignal, so landing
  // there immediately is a strict UX win over waiting for the chain.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(async (response) => {
      const data = response.notification.request.content.data;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) { router.replace('/onboarding'); return; }

        // Prefetch fills the dedup caches so the destination home route
        // lazy-seeds from cache and skips its LoadingScreens. We need
        // useRelationship for routing (profile.role); we also kick off
        // useCircle in parallel so RecipientHomeScreen's inner gate
        // (`circleLoading || dataLoading`) doesn't flash either.
        const [{ profile }] = await Promise.all([
          prefetchRelationship(),
          prefetchCircle().catch(() => null),
        ]);
        const role = profile?.role;

        // Step 1: navigate immediately based on role. Home screens render
        // any active SOS via useUrgentSignal, so this lands the user where
        // they need to be without waiting on more network calls.
        if (role === 'signaler') router.replace('/signaler-home');
        else if (role === 'recipient') router.replace('/recipient-home');
        else if (role === 'trusted') router.replace('/trusted-support');
        else { router.replace('/onboarding'); return; }

        // Step 2: for SOS / missed_checkin pushes, edge case: the same user
        // may be a primary recipient for one pair AND a trusted contact for
        // a different pair. If the alert belongs to the trusted-side pair,
        // re-route to /trusted-support. Runs in background; the wrong-but-
        // close screen is already showing while this resolves.
        if ((data?.type === 'sos' || data?.type === 'missed_checkin') && data?.alert_id && role === 'recipient') {
          try {
            const { data: alert } = await supabase
              .from('alert_cases').select('senior_id').eq('id', data.alert_id).maybeSingle();
            if (!alert) return;
            const { data: pair } = await supabase
              .from('care_pairs').select('id, caregiver_id')
              .eq('senior_id', alert.senior_id).eq('status', 'active').maybeSingle();
            if (pair && pair.caregiver_id !== session.user.id) {
              const { data: tc } = await supabase
                .from('trusted_contacts').select('id')
                .eq('relationship_id', pair.id).eq('user_id', session.user.id)
                .eq('status', 'active').maybeSingle();
              if (tc) router.replace('/trusted-support');
            }
          } catch { /* background refinement; leave the user where they landed */ }
        }
      } catch {
        // Network error during push handling — go to index which will route correctly
        router.replace('/');
      }
    });
    return () => sub.remove();
  }, [router]);

  // Rejestruj push token przy uruchomieniu + po zalogowaniu + po wznowieniu
  // Identify user in PostHog after auth
  const lastPushRegisterRef = useRef(0);
  // Track which (status, reason) pairs we've already captured this session.
  // Reduces Sentry noise: Sentry CMOK-3/4/5/7 each fired 11–55× because we
  // captured a warning every foreground when the device was a simulator
  // (always 'skipped') or had permissions denied (always 'unavailable')
  // or hit a flaky edge function (often 'failed'). One capture per app
  // lifecycle is enough to know the state.
  const capturedPushStatesRef = useRef<Set<string>>(new Set());
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
        if (result.status === 'registered') return;
        // 'skipped' = simulator or web; 'unavailable' = user denied permission.
        // Both are expected states, not bugs — don't ship them to Sentry.
        // 'failed' is the only one we care about, and once per (reason,detail)
        // tells us the edge function path is misbehaving without spamming.
        if (result.status !== 'failed') return;
        const key = `${result.status}:${result.reason || 'none'}`;
        if (capturedPushStatesRef.current.has(key)) return;
        capturedPushStatesRef.current.add(key);
        Sentry.captureMessage(`push_register_${result.status}`, {
          level: 'warning',
          extra: { reason, detail: result.reason || null },
        });
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
