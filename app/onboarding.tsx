import { useState } from 'react';
import { Alert } from 'react-native';
import { Redirect } from 'expo-router';
import { WelcomeScreen } from '../src/screens/WelcomeScreen';
import { PhoneAuthScreen } from '../src/screens/PhoneAuthScreen';
import { VerifyCodeScreen, type VerifyResult } from '../src/screens/VerifyCodeScreen';
import { RoleScreen } from '../src/screens/RoleScreen';
import { RelationTypeScreen } from '../src/screens/RelationTypeScreen';
import { RelationNameScreen } from '../src/screens/RelationNameScreen';
import { SetupScreen } from '../src/screens/SetupScreen';
import { JoinScreen } from '../src/screens/JoinScreen';
import { LoadingScreen } from '../src/components/LoadingScreen';
import { supabase } from '../src/services/supabase';
import type { AppRole } from '../src/types';
import { toLegacyRole } from '../src/utils/roles';

type OnboardingStep = 'welcome' | 'phone-side' | 'relation-type' | 'relation-name' | 'phone' | 'verify' | 'setup' | 'join' | 'done';
type DestinationRoute = '/waiting' | '/signaler-home' | '/recipient-home' | null;

export default function OnboardingFlow() {
  const [step, setStep] = useState<OnboardingStep>('welcome');
  const [phone, setPhone] = useState('');
  const [selectedRole, setSelectedRole] = useState<AppRole | null>(null);
  const [relationType, setRelationType] = useState('Bliska osoba');
  const [relationLabel, setRelationLabel] = useState('Bliska osoba');
  const [destinationRoute, setDestinationRoute] = useState<DestinationRoute>(null);

  const createProfileForRole = async (role: AppRole) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) throw new Error('Brak sesji');

    const payload = {
      id: user.id,
      phone: user.phone || phone,
      name: role === 'signaler' ? 'Ja' : 'Bliska osoba',
      role,
    };

    const { error } = await supabase
      .from('users')
      .upsert(payload, { onConflict: 'id' });

    if (!error) return;

    const { error: legacyError } = await supabase
      .from('users')
      .upsert(
        {
          ...payload,
          role: toLegacyRole(role),
        },
        { onConflict: 'id' }
      );

    if (legacyError) throw legacyError;
  };

  const handleVerified = async (result: VerifyResult) => {
    const { profile, relationshipStatus } = result;

    if (profile && relationshipStatus === 'active') {
      setSelectedRole(profile.role);
      setDestinationRoute(profile.role === 'signaler' ? '/signaler-home' : '/recipient-home');
      setStep('done');
      return;
    }

    if (profile && relationshipStatus === 'pending') {
      setSelectedRole(profile.role);
      if (profile.role === 'recipient') {
        setDestinationRoute('/waiting');
        setStep('done');
      } else {
        setStep('join');
      }
      return;
    }

    if (profile && relationshipStatus === 'none') {
      setSelectedRole(profile.role);
      setStep(profile.role === 'recipient' ? 'setup' : 'join');
      return;
    }

    if (selectedRole) {
      try {
        await createProfileForRole(selectedRole);
        setStep(selectedRole === 'recipient' ? 'setup' : 'join');
        return;
      } catch (err) {
        console.error('[onboarding] create profile after verify error:', err);
        Alert.alert('Błąd', 'Nie udało się utworzyć profilu. Spróbuj ponownie.');
        setStep('phone-side');
        return;
      }
    }

    setStep('phone-side');
  };

  const handlePhoneSideSelected = async (role: AppRole) => {
    setSelectedRole(role);
    setStep('relation-type');
  };

  const handleRelationTypeSelected = (value: string) => {
    setRelationType(value);
    setRelationLabel(value);
    setStep('relation-name');
  };

  const handleRelationNameSelected = (value: string) => {
    setRelationLabel(value);
    setStep('phone');
  };

  const handleConnectionCreated = () => {
    setDestinationRoute('/waiting');
    setStep('done');
  };

  const handleJoined = () => {
    setDestinationRoute('/signaler-home');
    setStep('done');
  };

  const goBack = () => {
    switch (step) {
      case 'phone-side':
        setStep('welcome');
        break;
      case 'relation-type':
        setStep('phone-side');
        break;
      case 'relation-name':
        setStep('relation-type');
        break;
      case 'phone':
        setStep('relation-name');
        break;
      case 'verify':
        setStep('phone');
        break;
      case 'setup':
      case 'join':
        if (selectedRole) {
          setStep('phone');
        } else {
          setStep('phone-side');
        }
        break;
    }
  };

  switch (step) {
    case 'welcome':
      return <WelcomeScreen onStart={() => setStep('phone-side')} />;

    case 'phone-side':
      return (
        <RoleScreen
          onSelectRole={handlePhoneSideSelected}
          onBack={goBack}
        />
      );

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
          relationLabel={relationLabel}
          onCodeSent={(nextPhone) => {
            setPhone(nextPhone);
            setStep('verify');
          }}
        />
      );

    case 'verify':
      return (
        <VerifyCodeScreen
          phone={phone}
          relationLabel={relationLabel}
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
          onDone={handleJoined}
          relationLabel={relationLabel}
        />
      );

    case 'done':
      if (destinationRoute) {
        return <Redirect href={destinationRoute} />;
      }
      return <LoadingScreen />;

    default:
      return <LoadingScreen />;
  }
}
