import { useState, useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LoadingScreen } from '../../src/components/LoadingScreen';
import { JoinScreen } from '../../src/screens/JoinScreen';
import { supabase } from '../../src/services/supabase';
import { logInviteEvent } from '../../src/utils/invite';
import { savePendingInvite, clearPendingInvite } from '../../src/utils/pendingInvite';
import { posthog } from '../../src/services/posthog';

/**
 * Deep link entry: cmok://join/{code}
 *
 * Authed → auto-join immediately.
 * Not authed → persist code, redirect to onboarding. After auth, index.tsx resumes.
 */
export default function JoinByCode() {
  const { code, src } = useLocalSearchParams<{ code: string; src?: string }>();
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [isAuthed, setIsAuthed] = useState(false);

  const cleanCode = (code || '').replace(/\D/g, '').slice(0, 6);
  const srcUserId = typeof src === 'string' && src.length > 0 ? src : null;

  useEffect(() => {
    logInviteEvent('join_link_opened', { code: cleanCode });

    // K-factor attribution: every time a share link is opened we log the
    // source user id (from `?src=`). Lets us measure invite→open→join per
    // inviter and per viral variant (via the `type` query on peer shares).
    posthog.capture('install_via_invite', {
      code: cleanCode,
      source_user_id: srcUserId,
      has_code: cleanCode.length === 6,
    });

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
      onDone={async (kind) => {
        clearPendingInvite();
        logInviteEvent('join_completed', { code: cleanCode, source: 'deep-link' });

        // Route + role depend on which kind of invite was redeemed:
        //   'pair'    — care-pair redeem → user becomes signaler → /signaler-home
        //   'trusted' — trusted-contact redeem → role set by DB trigger
        //               (activate_pending_trusted_contacts) to 'trusted'
        //               → /trusted-support. We do NOT overwrite the role here;
        //               that would have clobbered the trigger's 'trusted'
        //               assignment and misrouted them. Bug until commit
        //               introducing this fix.
        if (kind === 'trusted') {
          router.replace('/trusted-support');
          return;
        }

        // Care-pair path: make sure the account's role is 'signaler' (handles
        // the case where the user started onboarding with no role selected).
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await supabase.from('users').update({ role: 'signaler' }).eq('id', user.id);
          }
        } catch { /* best-effort role sync */ }
        router.replace('/signaler-home');
      }}
      relationLabel="bliską osobą"
    />
  );
}
