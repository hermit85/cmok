import { useState, useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LoadingScreen } from '../../src/components/LoadingScreen';
import { JoinScreen } from '../../src/screens/JoinScreen';
import { supabase } from '../../src/services/supabase';
import { logInviteEvent } from '../../src/utils/invite';
import { savePendingInvite, clearPendingInvite } from '../../src/utils/pendingInvite';

/**
 * Deep link entry: cmok://join/{code}
 *
 * Authed → auto-join immediately.
 * Not authed → persist code, redirect to onboarding. After auth, index.tsx resumes.
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
      // Always persist the code so it survives auth flow
      if (cleanCode.length === 6) {
        await savePendingInvite(cleanCode, 'deep-link');
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setIsAuthed(true);
      } else {
        // Not authed — code is persisted, send to onboarding
        router.replace('/onboarding');
        return;
      }
      setChecking(false);
    })();
  }, [cleanCode]);

  if (checking && !isAuthed) return <LoadingScreen />;

  // Authed — show JoinScreen with prefilled code, auto-join
  return (
    <JoinScreen
      initialCode={cleanCode}
      onBack={() => { clearPendingInvite(); router.replace('/'); }}
      onDone={() => {
        clearPendingInvite();
        logInviteEvent('join_completed', { code: cleanCode, source: 'deep-link' });
        router.replace('/signaler-home');
      }}
      relationLabel="bliską osobą"
    />
  );
}
