import { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LoadingScreen } from '../../src/components/LoadingScreen';
import { JoinScreen } from '../../src/screens/JoinScreen';
import { supabase } from '../../src/services/supabase';
import { logInviteEvent } from '../../src/utils/invite';

/**
 * Deep link entry: cmok://join/{code}
 *
 * If user is already authenticated and is a signaler, go straight to JoinScreen with prefilled code.
 * If not authenticated, redirect to onboarding with code param so they can sign up first.
 */
export default function JoinByCode() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [isAuthed, setIsAuthed] = useState(false);

  const cleanCode = (code || '').replace(/\D/g, '').slice(0, 6);

  useEffect(() => {
    logInviteEvent('join_link_opened', { code: cleanCode });

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setIsAuthed(true);
      }
      setChecking(false);
    })();
  }, [cleanCode]);

  if (checking) return <LoadingScreen />;

  if (!isAuthed) {
    // User needs to create account first — send to onboarding with code
    // They'll need to go through phone auth, then we'll redirect to join
    return (
      <JoinScreen
        initialCode={cleanCode}
        onBack={() => router.replace('/onboarding')}
        onDone={() => {
          logInviteEvent('join_completed', { code: cleanCode });
          router.replace('/signaler-home');
        }}
        relationLabel="bliską osobą"
        needsAuth
      />
    );
  }

  return (
    <JoinScreen
      initialCode={cleanCode}
      onBack={() => router.replace('/')}
      onDone={() => {
        logInviteEvent('join_completed', { code: cleanCode });
        router.replace('/signaler-home');
      }}
      relationLabel="bliską osobą"
    />
  );
}
