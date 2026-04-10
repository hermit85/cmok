import { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { Redirect } from 'expo-router';
import { getPendingInvite, clearPendingInvite } from '../src/utils/pendingInvite';
import { logInviteEvent } from '../src/utils/invite';
import { WelcomeScreen } from '../src/screens/WelcomeScreen';
import { IntentScreen } from '../src/screens/IntentScreen';
import { PhoneAuthScreen } from '../src/screens/PhoneAuthScreen';
import { VerifyCodeScreen, type VerifyResult } from '../src/screens/VerifyCodeScreen';
import { RelationTypeScreen } from '../src/screens/RelationTypeScreen';
import { RelationNameScreen } from '../src/screens/RelationNameScreen';
import { SetupScreen } from '../src/screens/SetupScreen';
import { JoinScreen } from '../src/screens/JoinScreen';
import { LoadingScreen } from '../src/components/LoadingScreen';
import { supabase } from '../src/services/supabase';
import type { AppRole } from '../src/types';
import { toLegacyRole } from '../src/utils/roles';

/*
  Flow A (setup-phone): welcome → intent → relation-type → [relation-name] → phone → verify → setup → done(/waiting)
  Flow B (join-circle): welcome → intent → phone → verify → join → done(/signaler-home)
                         OR: welcome → intent → join (if already authed)
*/

type OnboardingStep =
  | 'welcome'
  | 'intent'
  | 'relation-type'
  | 'relation-name'
  | 'phone'
  | 'verify'
  | 'setup'
  | 'join'
  | 'done';

type DestinationRoute = '/waiting' | '/signaler-home' | '/recipient-home' | null;

const STANDARD_RELATIONS = ['Mama', 'Tata', 'Babcia', 'Dziadek'];

export default function OnboardingFlow() {
  const [step, setStep] = useState<OnboardingStep>('welcome');
  const [phone, setPhone] = useState('');
  const [selectedRole, setSelectedRole] = useState<AppRole | null>(null);
  const [relationType, setRelationType] = useState('Bliska osoba');
  const [relationLabel, setRelationLabel] = useState('Bliska osoba');
  const [destinationRoute, setDestinationRoute] = useState<DestinationRoute>(null);
  const [pendingInviteCode, setPendingInviteCode] = useState<string | null>(null);

  // Check for pending invite on mount
  useEffect(() => {
    getPendingInvite().then((invite) => {
      if (invite) setPendingInviteCode(invite.code);
    });
  }, []);

  /* ─── helpers ─── */

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

  /* ─── handlers ─── */

  const handleIntent = (intent: 'setup-phone' | 'join-circle') => {
    if (intent === 'setup-phone') {
      // Path A: setting up signaler's phone → pick who the person is → auth → setup
      setSelectedRole('signaler');
      setStep('relation-type');
    } else {
      // Path B: joining circle as recipient → auth → join code
      setSelectedRole('recipient');
      setStep('phone');
    }
  };

  const handleRelationTypeSelected = (value: string) => {
    setRelationType(value);
    setRelationLabel(value);
    if (STANDARD_RELATIONS.includes(value)) {
      setStep('phone');
    } else {
      setStep('relation-name');
    }
  };

  const handleRelationNameSelected = (value: string) => {
    setRelationLabel(value);
    setStep('phone');
  };

  const handleVerified = async (result: VerifyResult) => {
    const { profile, relationshipStatus } = result;

    // Check: is there a pending invite code waiting to be used?
    const pendingInvite = await getPendingInvite();

    // Existing user with active relationship → go home
    if (profile && relationshipStatus === 'active') {
      if (pendingInvite) await clearPendingInvite();
      setSelectedRole(profile.role);
      setDestinationRoute(profile.role === 'signaler' ? '/signaler-home' : '/recipient-home');
      setStep('done');
      return;
    }

    // Existing user with pending → waiting or join
    if (profile && relationshipStatus === 'pending') {
      setSelectedRole(profile.role);
      if (profile.role === 'recipient') {
        setDestinationRoute('/waiting');
        setStep('done');
      } else {
        // Has pending invite? Prefill the code
        if (pendingInvite) {
          logInviteEvent('invite_resume_started', { code: pendingInvite.code });
          setPendingInviteCode(pendingInvite.code);
        }
        setStep('join');
      }
      return;
    }

    // Existing user, no relationship → route by role (or use pending invite)
    if (profile && relationshipStatus === 'none') {
      setSelectedRole(profile.role);
      if (pendingInvite && profile.role !== 'recipient') {
        logInviteEvent('invite_resume_started', { code: pendingInvite.code });
        setPendingInviteCode(pendingInvite.code);
        setStep('join');
      } else {
        setStep(profile.role === 'recipient' ? 'setup' : 'join');
      }
      return;
    }

    // New user → create profile then route
    if (selectedRole) {
      try {
        await createProfileForRole(selectedRole);
        // After creating profile, check pending invite
        if (pendingInvite && selectedRole !== 'recipient') {
          logInviteEvent('invite_resume_started', { code: pendingInvite.code });
          setPendingInviteCode(pendingInvite.code);
          setStep('join');
        } else {
          setStep(selectedRole === 'recipient' ? 'setup' : 'join');
        }
      } catch (err) {
        console.error('[onboarding] create profile error:', err);
        Alert.alert('Błąd', 'Nie udało się utworzyć profilu. Spróbuj ponownie.');
        setStep('intent');
      }
      return;
    }

    setStep('intent');
  };

  const handleConnectionCreated = () => {
    setDestinationRoute('/waiting');
    setStep('done');
  };

  const handleJoined = () => {
    setDestinationRoute('/signaler-home');
    setStep('done');
  };

  /* ─── back navigation ─── */

  const goBack = () => {
    switch (step) {
      case 'intent':
        setStep('welcome');
        break;
      case 'relation-type':
        setStep('intent');
        break;
      case 'relation-name':
        setStep('relation-type');
        break;
      case 'phone':
        // Path A: back to relation. Path B: back to intent.
        if (selectedRole === 'signaler') {
          STANDARD_RELATIONS.includes(relationType)
            ? setStep('relation-type')
            : setStep('relation-name');
        } else {
          setStep('intent');
        }
        break;
      case 'verify':
        setStep('phone');
        break;
      case 'setup':
      case 'join':
        setStep('phone');
        break;
    }
  };

  /* ─── render ─── */

  switch (step) {
    case 'welcome':
      return <WelcomeScreen onStart={() => setStep('intent')} />;

    case 'intent':
      return <IntentScreen onSelect={handleIntent} onBack={goBack} />;

    case 'relation-type':
      return (
        <RelationTypeScreen
          initialValue={relationType}
          onBack={goBack}
          onContinue={handleRelationTypeSelected}
        />
      );

    case 'relation-name':
      return (
        <RelationNameScreen
          initialValue={relationLabel}
          relationType={relationType}
          selectedRole={selectedRole}
          onBack={goBack}
          onContinue={handleRelationNameSelected}
        />
      );

    case 'phone':
      return (
        <PhoneAuthScreen
          onBack={goBack}
          selectedRole={selectedRole}
          relationLabel={selectedRole === 'recipient' ? 'bliskiej osoby' : relationLabel}
          onCodeSent={(nextPhone) => { setPhone(nextPhone); setStep('verify'); }}
        />
      );

    case 'verify':
      return (
        <VerifyCodeScreen
          phone={phone}
          relationLabel={selectedRole === 'recipient' ? 'bliskiej osoby' : relationLabel}
          onVerified={handleVerified}
          onBack={goBack}
        />
      );

    case 'setup':
      return (
        <SetupScreen
          onDone={handleConnectionCreated}
          onBack={goBack}
          initialLabel={relationLabel}
        />
      );

    case 'join':
      return (
        <JoinScreen
          onBack={goBack}
          onDone={() => {
            if (pendingInviteCode) {
              clearPendingInvite();
              logInviteEvent('invite_resume_completed', { code: pendingInviteCode });
            }
            handleJoined();
          }}
          relationLabel={relationLabel}
          initialCode={pendingInviteCode || ''}
        />
      );

    case 'done':
      if (destinationRoute) return <Redirect href={destinationRoute} />;
      return <LoadingScreen />;

    default:
      return <LoadingScreen />;
  }
}
