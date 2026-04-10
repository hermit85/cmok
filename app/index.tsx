import { useState, useEffect } from 'react';
import { Redirect } from 'expo-router';
import { LoadingScreen } from '../src/components/LoadingScreen';
import { useRelationship } from '../src/hooks/useRelationship';
import { getPendingInvite } from '../src/utils/pendingInvite';

type Destination = '/onboarding' | '/waiting' | '/signaler-home' | '/recipient-home' | '/trusted-support' | string;

export default function Index() {
  const { loading, sessionReady, profile, status, hasTrustedAccess } = useRelationship();
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [checkedPending, setCheckedPending] = useState(false);

  // Check for pending invite code after session is ready
  useEffect(() => {
    if (!sessionReady) return;
    (async () => {
      const pending = await getPendingInvite();
      if (pending && profile) {
        // User has auth + pending code → resume join
        setPendingCode(pending.code);
      }
      setCheckedPending(true);
    })();
  }, [sessionReady, profile]);

  if (loading || !sessionReady || !checkedPending) {
    return <LoadingScreen />;
  }

  // Pending invite code takes priority — resume join flow
  if (pendingCode && profile) {
    return <Redirect href={`/join/${pendingCode}`} />;
  }

  let destination: Destination = '/onboarding';

  if (!profile) {
    destination = '/onboarding';
  } else if (status === 'pending' && profile.role === 'recipient') {
    destination = '/waiting';
  } else if (status === 'active') {
    destination = profile.role === 'signaler' ? '/signaler-home' : '/recipient-home';
  } else if (hasTrustedAccess) {
    destination = '/trusted-support';
  }

  return <Redirect href={destination} />;
}
