import { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { Redirect } from 'expo-router';
import { getPendingInvite, savePendingInvite, clearPendingInvite } from '../src/utils/pendingInvite';
import { logInviteEvent } from '../src/utils/invite';
import { WelcomeScreen } from '../src/screens/WelcomeScreen';
import { EnterCodeScreen } from '../src/screens/EnterCodeScreen';
import { WhoGetsSignScreen } from '../src/screens/WhoGetsSignScreen';
import { PhoneAuthScreen, type VerifyResult } from '../src/screens/PhoneAuthScreen';
import { SetupScreen } from '../src/screens/SetupScreen';
import { JoinScreen } from '../src/screens/JoinScreen';
import { LoadingScreen } from '../src/components/LoadingScreen';
import { supabase } from '../src/services/supabase';
import type { AppRole } from '../src/types';


/*
  Path A — signaler ("Mam kod zaproszenia"):
    Deep link:    → phone → who-gets-sign → join (prefilled) → /signaler-home
    Manual code:  welcome → enter-code → phone → who-gets-sign → join → /signaler-home

  Path B — recipient ("Chcę zaprosić bliską osobę"):
    welcome → phone → setup (name + generate code) → /waiting
*/

type Step = 'loading' | 'welcome' | 'enter-code' | 'phone' | 'who-gets-sign' | 'setup' | 'join' | 'done';
type DestinationRoute = '/waiting' | '/signaler-home' | '/recipient-home' | null;

export default function OnboardingFlow() {
  const [step, setStep] = useState<Step>('loading');
  const [selectedRole, setSelectedRole] = useState<AppRole | null>(null);
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
          if (pending) {
            setPendingInviteCode(pending.code);
            setSelectedRole('signaler');
            setStep('join');
          } else {
            setSelectedRole(profile.role as AppRole);
            setStep(profile.role === 'recipient' ? 'setup' : 'join');
          }
          return;
        }
      }

      // Not authed or no profile
      if (pending) {
        // Deep link code saved → signaler flow, skip to phone
        setPendingInviteCode(pending.code);
        setSelectedRole('signaler');
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

    // Check if profile already exists (may have been created in a previous session)
    const { data: existing } = await supabase
      .from('users').select('id, role').eq('id', user.id).maybeSingle();

    if (existing) {
      // Profile exists — don't overwrite, just continue
      return;
    }

    const defaultName = role === 'signaler' ? 'Ja' : 'Bliska osoba';
    const phone = user.phone ? (user.phone.startsWith('+') ? user.phone : `+${user.phone}`) : '';
    const { error } = await supabase.from('users').insert({
      id: user.id, phone, name: defaultName, role,
    });

    if (error) {
      // If insert fails due to duplicate, profile was created concurrently — that's OK
      if (error.code === '23505') return;
      throw error;
    }
  };

  /* ─── Welcome handlers ─── */

  const handleHasCode = () => {
    logInviteEvent('onboarding_started');
    setSelectedRole('signaler');
    setStep('enter-code');
  };

  const handleWantsToInvite = () => {
    logInviteEvent('onboarding_started');
    setSelectedRole('recipient');
    setStep('phone');
  };

  const handleCodeEntered = async (code: string) => {
    await savePendingInvite(code, 'manual');
    setPendingInviteCode(code);
    logInviteEvent('invite_code_submitted', { code });
    setStep('phone');
  };

  /* ─── Post-auth handler ─── */

  const handleVerified = async (result: VerifyResult) => {
    const { profile, relationshipStatus } = result;
    const role = selectedRole || 'signaler';
    const pendingInvite = await getPendingInvite();

    // Already has active relationship → go home
    if (profile && relationshipStatus === 'active') {
      if (pendingInvite) await clearPendingInvite();
      setDestinationRoute(profile.role === 'signaler' ? '/signaler-home' : '/recipient-home');
      setStep('done');
      return;
    }

    // Has profile → continue to next step (route based on selectedRole, not profile.role)
    if (profile) {
      if (pendingInvite) {
        setPendingInviteCode(pendingInvite.code);
        logInviteEvent('invite_resume_started', { code: pendingInvite.code });
      }
      if (role === 'recipient') {
        if (relationshipStatus === 'pending') { setDestinationRoute('/waiting'); setStep('done'); }
        else setStep('setup');
      } else {
        setStep('who-gets-sign');
      }
      return;
    }

    // New user — create profile
    try {
      await createProfileForRole(role);
      if (pendingInvite) {
        setPendingInviteCode(pendingInvite.code);
        logInviteEvent('invite_resume_started', { code: pendingInvite.code });
      }
      if (role === 'recipient') {
        setStep('setup');
      } else {
        setStep('who-gets-sign');
      }
    } catch (err: any) {
      const detail = err?.code ? `code=${err.code} msg=${err.message} details=${err.details} hint=${err.hint}` : String(err);
      console.error('[onboarding] createProfile error:', detail, JSON.stringify(err));
      Alert.alert('Błąd', `Nie udało się utworzyć profilu.\n\n${detail}`);
      setStep('phone');
    }
  };

  /* ─── Step handlers ─── */

  const handleWhoGetsSign = (name: string) => {
    setRecipientName(name);
    setStep('join');
  };

  const handleSetupDone = () => {
    setDestinationRoute('/waiting');
    setStep('done');
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
      case 'phone':
        if (selectedRole === 'signaler' && pendingInviteCode) setStep('welcome');
        else if (selectedRole === 'signaler') setStep('enter-code');
        else setStep('welcome');
        break;
      case 'who-gets-sign': setStep('phone'); break;
      case 'setup': setStep('phone'); break;
      case 'join': setStep('who-gets-sign'); break;
    }
  };

  /* ─── Render ─── */

  switch (step) {
    case 'loading':
      return <LoadingScreen />;
    case 'welcome':
      return <WelcomeScreen onHasCode={handleHasCode} onWantsToInvite={handleWantsToInvite} />;
    case 'enter-code':
      return <EnterCodeScreen onSubmit={handleCodeEntered} onBack={goBack} />;
    case 'phone':
      return <PhoneAuthScreen onBack={goBack} onVerified={handleVerified} />;
    case 'who-gets-sign':
      return <WhoGetsSignScreen onContinue={handleWhoGetsSign} onBack={goBack} />;
    case 'setup':
      return <SetupScreen onDone={handleSetupDone} onBack={goBack} initialLabel={recipientName || ''} />;
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
