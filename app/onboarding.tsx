import { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { Redirect } from 'expo-router';
import { getPendingInvite, savePendingInvite, clearPendingInvite } from '../src/utils/pendingInvite';
import { logInviteEvent } from '../src/utils/invite';
import { WelcomeScreen } from '../src/screens/WelcomeScreen';
import { EnterCodeScreen } from '../src/screens/EnterCodeScreen';
import { WhoGetsSignScreen } from '../src/screens/WhoGetsSignScreen';
import { PhoneAuthScreen, type VerifyResult } from '../src/screens/PhoneAuthScreen';
import { JoinScreen } from '../src/screens/JoinScreen';
import { LoadingScreen } from '../src/components/LoadingScreen';
import { supabase } from '../src/services/supabase';
import type { AppRole } from '../src/types';
import { toLegacyRole } from '../src/utils/roles';

/*
  Two paths — both are signaler:

  Deep link (invite code in URL):
    → phone (+ SMS verify) → who-gets-sign → join (prefilled) → done

  No deep link:
    welcome → enter-code → phone (+ SMS verify) → who-gets-sign → join → done
*/

type Step = 'loading' | 'welcome' | 'enter-code' | 'phone' | 'who-gets-sign' | 'join' | 'done';
type DestinationRoute = '/waiting' | '/signaler-home' | '/recipient-home' | null;

export default function OnboardingFlow() {
  const [step, setStep] = useState<Step>('loading');
  const [recipientName, setRecipientName] = useState('');
  const [destinationRoute, setDestinationRoute] = useState<DestinationRoute>(null);
  const [pendingInviteCode, setPendingInviteCode] = useState<string | null>(null);

  // On mount: check for pending invite code and existing auth
  useEffect(() => {
    (async () => {
      const pending = await getPendingInvite();

      // Auto-resume: user already has auth + profile → skip to right step
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: profile } = await supabase
          .from('users').select('id, role, name').eq('id', session.user.id).maybeSingle();

        if (profile) {
          // Already has profile — go to join or done
          if (pending) {
            setPendingInviteCode(pending.code);
            setStep('join');
          } else {
            setStep('join');
          }
          return;
        }
      }

      // Not authed or no profile
      if (pending) {
        // Deep link code saved → skip straight to phone auth
        setPendingInviteCode(pending.code);
        logInviteEvent('invite_resume_started', { code: pending.code });
        setStep('phone');
      } else {
        setStep('welcome');
      }
    })();
  }, []);

  const createProfileForRole = async (role: AppRole) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Brak sesji');
    const payload = { id: user.id, phone: user.phone || '', name: 'Ja', role };
    const { error } = await supabase.from('users').upsert(payload, { onConflict: 'id' });
    if (!error) return;
    const { error: legacyError } = await supabase.from('users').upsert(
      { ...payload, role: toLegacyRole(role) }, { onConflict: 'id' },
    );
    if (legacyError) throw legacyError;
  };

  const handleCodeEntered = async (code: string) => {
    await savePendingInvite(code, 'manual');
    setPendingInviteCode(code);
    logInviteEvent('invite_code_submitted', { code });
    setStep('phone');
  };

  const handleVerified = async (result: VerifyResult) => {
    const { profile, relationshipStatus } = result;
    const pendingInvite = await getPendingInvite();

    // Already has active relationship → go home
    if (profile && relationshipStatus === 'active') {
      if (pendingInvite) await clearPendingInvite();
      setDestinationRoute(profile.role === 'signaler' ? '/signaler-home' : '/recipient-home');
      setStep('done');
      return;
    }

    // Has profile → skip to who-gets-sign or join
    if (profile) {
      if (pendingInvite) {
        setPendingInviteCode(pendingInvite.code);
        logInviteEvent('invite_resume_started', { code: pendingInvite.code });
      }
      setStep('who-gets-sign');
      return;
    }

    // New user — create signaler profile, then continue
    try {
      await createProfileForRole('signaler');
      if (pendingInvite) {
        setPendingInviteCode(pendingInvite.code);
        logInviteEvent('invite_resume_started', { code: pendingInvite.code });
      }
      setStep('who-gets-sign');
    } catch (err) {
      console.error('[onboarding] createProfile error:', err);
      Alert.alert('Błąd', 'Nie udało się utworzyć profilu. Spróbuj ponownie.');
      setStep('phone');
    }
  };

  const handleWhoGetsSign = (name: string) => {
    setRecipientName(name);
    setStep('join');
  };

  const handleJoined = () => {
    if (pendingInviteCode) {
      clearPendingInvite();
      logInviteEvent('invite_resume_completed', { code: pendingInviteCode });
    }
    setDestinationRoute('/signaler-home');
    setStep('done');
  };

  const goBack = () => {
    switch (step) {
      case 'enter-code': setStep('welcome'); break;
      case 'phone': setStep(pendingInviteCode ? 'welcome' : 'enter-code'); break;
      case 'who-gets-sign': setStep('phone'); break;
      case 'join': setStep('who-gets-sign'); break;
    }
  };

  switch (step) {
    case 'loading':
      return <LoadingScreen />;
    case 'welcome':
      return <WelcomeScreen onStart={() => { logInviteEvent('onboarding_started'); setStep('enter-code'); }} />;
    case 'enter-code':
      return <EnterCodeScreen onSubmit={handleCodeEntered} onBack={goBack} />;
    case 'phone':
      return <PhoneAuthScreen onBack={goBack} onVerified={handleVerified} />;
    case 'who-gets-sign':
      return <WhoGetsSignScreen onContinue={handleWhoGetsSign} onBack={goBack} />;
    case 'join':
      return (
        <JoinScreen onBack={goBack} onDone={handleJoined}
          relationLabel={recipientName || 'bliską osobą'} initialCode={pendingInviteCode || ''} />
      );
    case 'done':
      if (destinationRoute) return <Redirect href={destinationRoute} />;
      return <LoadingScreen />;
    default:
      return <LoadingScreen />;
  }
}
