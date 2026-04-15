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
import { analytics } from '../src/services/analytics';

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
  const [pendingChecked, setPendingChecked] = useState(false);

  useEffect(() => {
    getPendingInvite().then((inv) => {
      if (inv) setPendingInviteCode(inv.code);
      setPendingChecked(true);
    });
  }, []);

  // Auto-resume: skip onboarding if user has an existing relationship
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
        .from('care_pairs').select('id, status').eq(col, session.user.id).in('status', ['active', 'pending']).order('status').limit(1).maybeSingle();

      if (activePair?.status === 'active') {
        setSelectedRole(role);
        setDestinationRoute(role === 'signaler' ? '/signaler-home' : '/recipient-home');
        setStep('done');
      } else if (activePair?.status === 'pending' && role === 'recipient') {
        // Recipient waiting for signaler to join
        setSelectedRole(role);
        setDestinationRoute('/waiting');
        setStep('done');
      } else if (activePair?.status === 'pending' && role === 'signaler') {
        // Signaler has pending pair — go to join screen
        setSelectedRole(role);
        setStep('join');
      }
      // No relationship at all → stay on welcome for full onboarding
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
      analytics.onboardingIntent('signaler');
      setStep(ALLOW_ORGANIC_SIGNUP ? 'who-gets-sign' : 'phone');
    } else {
      setSelectedRole('recipient');
      analytics.onboardingIntent('recipient');
      setStep('phone');
    }
  };

  const handleWhoGetsSign = (name: string) => {
    setRecipientName(name);
    setStep('phone');
  };

  const handleVerified = async (result: VerifyResult) => {
    const { profile, relationshipStatus } = result;
    analytics.onboardingVerified(!!profile, relationshipStatus);
    const pendingInvite = await getPendingInvite();

    // Case 1: Active relationship → go home. Role from DB is authoritative.
    if (profile && relationshipStatus === 'active') {
      if (pendingInvite) await clearPendingInvite();
      setDestinationRoute(profile.role === 'signaler' ? '/signaler-home' : '/recipient-home');
      setStep('done');
      return;
    }

    // Case 2: Profile exists, pending relationship
    if (profile && relationshipStatus === 'pending') {
      const effectiveRole = selectedRole || profile.role;
      if (selectedRole && selectedRole !== profile.role) {
        await supabase.from('users').update({ role: selectedRole }).eq('id', profile.id);
      }
      if (effectiveRole === 'recipient') {
        const { data: pair } = await supabase
          .from('care_pairs').select('id').eq('caregiver_id', profile.id).eq('status', 'pending').limit(1).maybeSingle();
        if (pair) {
          setDestinationRoute('/waiting'); setStep('done');
        } else {
          setStep('setup');
        }
      } else {
        // Signaler: check if they already have an active pair (re-login case)
        const { data: activePair } = await supabase
          .from('care_pairs').select('id').eq('senior_id', profile.id).eq('status', 'active').limit(1).maybeSingle();
        if (activePair) {
          setDestinationRoute('/signaler-home'); setStep('done');
        } else {
          setStep('join');
        }
      }
      return;
    }

    // Case 3: Profile exists, no relationship found by useRelationship
    // Double-check: user might have an active pair that wasn't found during verify
    if (profile && relationshipStatus === 'none') {
      const col = profile.role === 'recipient' ? 'caregiver_id' : 'senior_id';
      const { data: anyPair } = await supabase
        .from('care_pairs').select('status').eq(col, profile.id).in('status', ['active', 'pending']).limit(1).maybeSingle();
      if (anyPair?.status === 'active') {
        setDestinationRoute(profile.role === 'signaler' ? '/signaler-home' : '/recipient-home');
        setStep('done');
        return;
      }
      if (anyPair?.status === 'pending' && profile.role === 'recipient') {
        setDestinationRoute('/waiting'); setStep('done');
        return;
      }
      // Truly no relationship — go to setup/join
      if (selectedRole && selectedRole !== profile.role) {
        await supabase.from('users').update({ role: selectedRole }).eq('id', profile.id);
      }
      const effectiveRole = selectedRole || profile.role;
      setStep(effectiveRole === 'recipient' ? 'setup' : 'join');
      return;
    }

    // Case 4: No profile — new user
    if (selectedRole) {
      try {
        await createProfileForRole(selectedRole);
        setStep(selectedRole === 'recipient' ? 'setup' : 'join');
      } catch (err) {
        console.warn('[onboarding] createProfile error:', err);
        Alert.alert('Błąd', 'Nie udało się utworzyć profilu.');
        setStep('intent');
      }
      return;
    }

    // Case 5: No profile AND no selectedRole (came from "Mam już konto" but no profile)
    Alert.alert('Nie znaleźliśmy konta', 'Ten numer nie ma jeszcze konta w cmok. Zacznij od nowa.');
    setStep('intent');
  };

  const handleConnectionCreated = async () => {
    analytics.onboardingCompleted('recipient');
    // Check if pair is already active (e.g. setup screen detected existing pair)
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: pair } = await supabase.from('care_pairs').select('status').eq('caregiver_id', user.id).eq('status', 'active').limit(1).maybeSingle();
      if (pair) { setDestinationRoute('/recipient-home'); setStep('done'); return; }
    }
    setDestinationRoute('/waiting'); setStep('done');
  };
  const handleJoined = () => { analytics.onboardingCompleted('signaler'); setDestinationRoute('/signaler-home'); setStep('done'); };

  const goBack = () => {
    switch (step) {
      case 'intent': setStep('welcome'); break;
      case 'who-gets-sign': setStep('intent'); break;
      case 'phone': {
        if (!selectedRole) setStep('welcome'); // came from "Mam już konto"
        else if (pendingInviteCode) setStep('welcome');
        else if (selectedRole === 'signaler' && ALLOW_ORGANIC_SIGNUP) setStep('who-gets-sign');
        else setStep('intent');
        break;
      }
      case 'setup': case 'join': setStep('phone'); break;
    }
  };

  // Wait for pending invite check before rendering welcome
  if (step === 'welcome' && !pendingChecked) {
    return <LoadingScreen />;
  }

  switch (step) {
    case 'welcome':
      return <WelcomeScreen
        onStart={() => {
          logInviteEvent('onboarding_started');
          analytics.onboardingStarted();
          if (pendingInviteCode) {
            setSelectedRole('signaler');
            setStep('phone');
          } else {
            setStep('intent');
          }
        }}
        onLogin={async () => {
          // If there's a pending invite code, set signaler role before auth
          if (pendingInviteCode) {
            setSelectedRole('signaler');
          }
          // Check if already logged in
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            const { data: profile } = await supabase
              .from('users').select('id, role, name').eq('id', session.user.id).maybeSingle();
            if (profile) {
              const role = profile.role === 'signaler' || profile.role === 'recipient' ? profile.role as AppRole : null;
              if (role) {
                const col = role === 'recipient' ? 'caregiver_id' : 'senior_id';
                const { data: pair } = await supabase
                  .from('care_pairs').select('status').eq(col, session.user.id).in('status', ['active', 'pending']).limit(1).maybeSingle();
                if (pair?.status === 'active') {
                  setDestinationRoute(role === 'signaler' ? '/signaler-home' : '/recipient-home');
                  setStep('done');
                  return;
                }
                if (pair?.status === 'pending' && role === 'recipient') {
                  setDestinationRoute('/waiting');
                  setStep('done');
                  return;
                }
              }
            }
          }
          setStep('phone');
        }}
      />;
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
      return <SetupScreen onDone={handleConnectionCreated} onBack={goBack} />;
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
