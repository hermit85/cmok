import { Redirect } from 'expo-router';
import { LoadingScreen } from '../src/components/LoadingScreen';
import { useRelationship } from '../src/hooks/useRelationship';

type Destination = '/onboarding' | '/waiting' | '/signaler-home' | '/recipient-home' | '/trusted-support';

export default function Index() {
  const { loading, sessionReady, profile, status, hasTrustedAccess } = useRelationship();

  if (loading || !sessionReady) {
    return <LoadingScreen />;
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
