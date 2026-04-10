import { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { Redirect } from 'expo-router';
import { getPendingInvite, clearPendingInvite } from '../src/utils/pendingInvite';
import { logInviteEvent } from '../src/utils/invite';
import { WelcomeScreen } from '../src/screens/WelcomeScreen';
import { IntentScreen, type UserIntent } from '../src/screens/IntentScreen';
import { WhoGetsSignScreen } from '../src/screens/WhoGetsSignScreen';
import { PhoneAuthScreen } from '../src/screens/PhoneAuthScreen';
import { VerifyCodeScreen, type VerifyResult } from '../src/screens/VerifyCodeScreen';
import { SetupScreen } from '../src/screens/SetupScreen';
import { JoinScreen } from '../src/screens/JoinScreen';
import { LoadingScreen } from '../src/components/LoadingScreen';
import { supabase } from '../src/services/supabase';
import type { AppRole } from '../src/types';
import { toLegacyRole } from '../src/utils/roles';

/*
  Path A (signaler): welcome → intent → who-gets-sign → phone → verify → setup → done(/waiting)
  Path B (recipient): welcome → intent → phone → verify → join → done(/signaler-home)
*/

type Step = 'welcome' | 'intent' | 'who-gets-sign' | 'phone' | 'verify' | 'setup' | 'join' | 'done';
type DestinationRoute = '/waiting' | '/signaler-home' | '/recipient-home' | null;

export default function OnboardingFlow() {
  const [step, setStep] = useState<Step>('welcome');
  const [phone, setPhone] = useState('');
  const [selectedRole, setSelectedRole] = useState<AppRole | null>(null);
  const [recipientName, setRecipientName] = useState('');
  const [destinationRoute, setDestinationRoute] = useState<DestinationRoute>(null);
  const [pendingInviteCode, setPendingInviteCode] = useState<string | null>(null);

  useEffect(() => {
    getPendingInvite().then((inv) => { if (inv) setPendingInviteCode(inv.code); });
  }, []);

  const createProfileForRole = async (role: AppRole) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Brak sesji');
    const payload = { id: user.id, phone: user.phone || phone, name: role === 'signaler' ? 'Ja' : 'Bliska osoba', role };
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
      setStep('who-gets-sign');
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

    if (profile && relationshipStatus === 'active') {
      if (pendingInvite) await clearPendingInvite();
      setSelectedRole(profile.role);
      setDestinationRoute(profile.role === 'signaler' ? '/signaler-home' : '/recipient-home');
      setStep('done');
      return;
    }
    if (profile && relationshipStatus === 'pending') {
      setSelectedRole(profile.role);
      if (profile.role === 'recipient') { setDestinationRoute('/waiting'); setStep('done'); }
      else {
        if (pendingInvite) { logInviteEvent('invite_resume_started', { code: pendingInvite.code }); setPendingInviteCode(pendingInvite.code); }
        setStep('join');
      }
      return;
    }
    if (profile && relationshipStatus === 'none') {
      setSelectedRole(profile.role);
      if (pendingInvite && profile.role !== 'recipient') {
        logInviteEvent('invite_resume_started', { code: pendingInvite.code }); setPendingInviteCode(pendingInvite.code); setStep('join');
      } else { setStep(profile.role === 'recipient' ? 'setup' : 'join'); }
      return;
    }
    if (selectedRole) {
      try {
        await createProfileForRole(selectedRole);
        if (pendingInvite && selectedRole !== 'recipient') {
          logInviteEvent('invite_resume_started', { code: pendingInvite.code }); setPendingInviteCode(pendingInvite.code); setStep('join');
        } else { setStep(selectedRole === 'recipient' ? 'setup' : 'join'); }
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
      case 'phone': setStep(selectedRole === 'signaler' ? 'who-gets-sign' : 'intent'); break;
      case 'verify': setStep('phone'); break;
      case 'setup': case 'join': setStep('phone'); break;
    }
  };

  switch (step) {
    case 'welcome':
      return <WelcomeScreen onStart={() => { logInviteEvent('onboarding_started'); setStep('intent'); }} />;
    case 'intent':
      return <IntentScreen onSelect={handleIntent} onBack={goBack} />;
    case 'who-gets-sign':
      return <WhoGetsSignScreen onContinue={handleWhoGetsSign} onBack={goBack} />;
    case 'phone':
      return (
        <PhoneAuthScreen onBack={goBack} selectedRole={selectedRole}
          relationLabel={recipientName || 'bliskiej osoby'}
          onCodeSent={(p) => { setPhone(p); setStep('verify'); }} />
      );
    case 'verify':
      return (
        <VerifyCodeScreen phone={phone} relationLabel={recipientName || 'bliskiej osoby'}
          onVerified={handleVerified} onBack={goBack} />
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
