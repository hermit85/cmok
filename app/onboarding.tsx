import { useState } from 'react';
import { useRouter } from 'expo-router';
import { WelcomeScreen } from '../src/screens/WelcomeScreen';
import { PhoneAuthScreen } from '../src/screens/PhoneAuthScreen';
import { VerifyCodeScreen } from '../src/screens/VerifyCodeScreen';
import { InviteScreen } from '../src/screens/InviteScreen';
import { JoinScreen } from '../src/screens/JoinScreen';

type Step = 'welcome' | 'phone' | 'verify' | 'invite' | 'join';

export default function OnboardingFlow() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('welcome');
  const [role, setRole] = useState<'senior' | 'caregiver'>('caregiver');
  const [phone, setPhone] = useState('');

  if (step === 'welcome') {
    return (
      <WelcomeScreen
        onSelectRole={(r) => {
          setRole(r);
          setStep('phone');
        }}
      />
    );
  }

  if (step === 'phone') {
    return (
      <PhoneAuthScreen
        onCodeSent={(p) => {
          setPhone(p);
          setStep('verify');
        }}
      />
    );
  }

  if (step === 'verify') {
    return (
      <VerifyCodeScreen
        phone={phone}
        role={role}
        onVerified={() => {
          if (role === 'caregiver') {
            setStep('invite');
          } else {
            setStep('join');
          }
        }}
      />
    );
  }

  if (step === 'invite') {
    return (
      <InviteScreen
        onDone={() => router.replace('/caregiver-dashboard')}
      />
    );
  }

  if (step === 'join') {
    return (
      <JoinScreen
        onJoined={() => router.replace('/senior-home')}
      />
    );
  }

  return null;
}
