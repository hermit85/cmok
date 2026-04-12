import { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { Redirect } from 'expo-router';
import { getPendingInvite, clearPendingInvite } from '../src/utils/pendingInvite';
import { logInviteEvent } from '../src/utils/invite';
import { WelcomeScreen } from '../src/screens/WelcomeScreen';
import { IntentScreen, type UserIntent } from '../src/screens/IntentScreen';
import { WhoGetsSignScreen } from '../src/screens/WhoGetsSignScreen';
import { PhoneVerifyScreen, type VerifyResult } from '../src/screens/PhoneVerifyScreen';
import { SetupScreen } from '../src/screens/SetupScreen';
import { JoinScreen } from '../src/screens/JoinScreen';
import { LoadingScreen } from '../src/components/LoadingScreen';
import { supabase } from '../src/services/supabase';
import type { AppRole } from '../src/types';
import { toLegacyRole } from '../src/utils/roles';

/*
  Path A (signaler): welcome → intent → who-gets-sign → phone(+verify) → join → done(/signaler-home)
  Path B (recipient): welcome → intent → phone(+verify) → setup → done(/waiting)

  When ALLOW_ORGANIC_SIGNUP is false, the intent screen shows simplified
  options and signaler path skips who-gets-sign (they already have a code).
*/

const ALLOW_ORGANIC_SIGNUP = false;

type Step = 'welcome' | 'intent' | 'who-gets-sign' | 'phone' | 'setup' | 'join' | 'done';
type DestinationRoute = '/waiting' | '/signaler-home' | '/recipient-home' | null;

export default function OnboardingFlow() {
  const [step, setStep] = useState<Step>('welcome');
  const [selectedRole, setSelectedRole] = useState<AppRole | null>(null);
  const [recipientName, setRecipientName] = useState('');
  const [destinationRoute, setDestinationRoute] = useState<DestinationRoute>(null);
  const [pendingInviteCode, setPendingInviteCode] = useState<string | null>(null);

  useEffect(() => {
    getPendingInvite().then((inv) => { if (inv) setPendingInviteCode(inv.code); });
  }, []);

  // Auto-resume: ONLY skip onboarding if user has an active relationship (re-login)
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return; // No auth → stay on welcome

      const { data: profile } = await supabase
        .from('users').select('id, role, name').eq('id', session.user.id).maybeSingle();
      if (!profile) return; // No profile → stay on welcome

      const role = profile.role === 'signaler' || profile.role === 'recipient' ? profile.role as AppRole : null;
      if (!role) return;

      // Check for active relationship
      const col = role === 'recipient' ? 'caregiver_id' : 'senior_id';
      const { data: activePair } = await supabase
        .from('care_pairs').select('id').eq(col, session.user.id).eq('status', 'active').limit(1).maybeSingle();

      if (activePair) {
        // Active relationship → re-login, go straight to home
        setSelectedRole(role);
        setDestinationRoute(role === 'signaler' ? '/signaler-home' : '/recipient-home');
        setStep('done');
      }
      // No active relationship → let user go through onboarding normally
    })();
  }, []);

  const createProfileForRole = async (role: AppRole) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Brak sesji');
    const payload = { id: user.id, phone: user.phone || '', name: role === 'signaler' ? 'Ja' : 'Bliska osoba', role };
    const { error } = await supabase.from('users').upsert(payload, { onConflict: 'id' });
    if (!error) return;
    const { error: legacyError } = await supabase.from('users').upsert(
      { ...payload, role: toLegacyRole(role) }, { onConflict: 'id' },
    );
    if (legacyError) throw legacyError;
  };

  const handleIntent = (intent: UserIntent) => {
    if (intent === 'i-am-center') {
      setSelectedRole('signaler');
      setStep(ALLOW_ORGANIC_SIGNUP ? 'who-gets-sign' : 'phone');
    } else {
      setSelectedRole('recipient');
      setStep('phone');
    }
  };

  const handleWhoGetsSign = (name: string) => {
    setRecipientName(name);
    setStep('phone');
  };

  const handleVerified = async (result: VerifyResult) => {
    const { profile, relationshipStatus } = result;
    const pendingInvite = await getPendingInvite();
    const role = selectedRole || 'signaler'; // fallback, but selectedRole should always be set by IntentScreen

    // Case 1: Active relationship → re-login, go home (role from DB is authoritative)
    if (profile && relationshipStatus === 'active') {
      if (pendingInvite) await clearPendingInvite();
      setDestinationRoute(profile.role === 'signaler' ? '/signaler-home' : '/recipient-home');
      setStep('done');
      return;
    }

    // Case 2: Profile exists but no active relationship → respect user's intent from IntentScreen
    if (profile) {
      // Update profile role if user picked a different path
      if (profile.role !== role) {
        await supabase.from('users').update({ role }).eq('id', profile.id).then(() => {});
      }
      if (pendingInvite && role === 'signaler') {
        logInviteEvent('invite_resume_started', { code: pendingInvite.code });
        setPendingInviteCode(pendingInvite.code);
      }
      setStep(role === 'recipient' ? 'setup' : 'join');
      return;
    }

    // Case 3: New user — create profile with selectedRole
    if (role) {
      try {
        await createProfileForRole(role);
        if (pendingInvite && role === 'signaler') {
          logInviteEvent('invite_resume_started', { code: pendingInvite.code });
          setPendingInviteCode(pendingInvite.code);
        }
        setStep(role === 'recipient' ? 'setup' : 'join');
      } catch (err) {
        console.error('[onboarding] error:', err);
        Alert.alert('Błąd', 'Nie udało się utworzyć profilu.');
        setStep('intent');
      }
      return;
    }

    setStep('intent');
  };

  const handleConnectionCreated = () => { setDestinationRoute('/waiting'); setStep('done'); };
  const handleJoined = () => { setDestinationRoute('/signaler-home'); setStep('done'); };

  const goBack = () => {
    switch (step) {
      case 'intent': setStep('welcome'); break;
      case 'who-gets-sign': setStep('intent'); break;
      case 'phone': {
        if (pendingInviteCode) setStep('welcome');
        else if (selectedRole === 'signaler' && ALLOW_ORGANIC_SIGNUP) setStep('who-gets-sign');
        else setStep('intent');
        break;
      }
      case 'setup': case 'join': setStep('phone'); break;
    }
  };

  switch (step) {
    case 'welcome':
      return <WelcomeScreen onStart={() => {
        logInviteEvent('onboarding_started');
        if (pendingInviteCode) {
          // Deep link invite → skip role selection, go straight to signaler auth
          setSelectedRole('signaler');
          logInviteEvent('invite_intent_skipped', { code: pendingInviteCode });
          setStep('phone');
        } else {
          setStep('intent');
        }
      }} />;
    case 'intent':
      return <IntentScreen onSelect={handleIntent} onBack={goBack} simplified={!ALLOW_ORGANIC_SIGNUP} />;
    case 'who-gets-sign':
      return <WhoGetsSignScreen onContinue={handleWhoGetsSign} onBack={goBack} />;
    case 'phone':
      return (
        <PhoneVerifyScreen onBack={goBack} selectedRole={selectedRole}
          relationLabel={recipientName || 'bliskiej osoby'}
          onVerified={handleVerified} />
      );
    case 'setup':
      return <SetupScreen onDone={handleConnectionCreated} onBack={goBack} initialLabel={recipientName || 'Bliska osoba'} />;
    case 'join':
      return (
        <JoinScreen onBack={goBack}
          onDone={() => { if (pendingInviteCode) { clearPendingInvite(); logInviteEvent('invite_resume_completed', { code: pendingInviteCode }); } handleJoined(); }}
          relationLabel={recipientName || 'bliską osobą'} initialCode={pendingInviteCode || ''} />
      );
    case 'done':
      if (destinationRoute) return <Redirect href={destinationRoute} />;
      return <LoadingScreen />;
    default:
      return <LoadingScreen />;
  }
}
