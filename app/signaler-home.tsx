import { useLocalSearchParams, Redirect } from 'expo-router';
import { SignalerHomeScreen } from '../src/screens/SignalerHomeScreen';
import { parseSignalerHomePreview } from '../src/dev/homePreview';
import { useRelationship } from '../src/hooks/useRelationship';
import { LoadingScreen } from '../src/components/LoadingScreen';

export default function SignalerHome() {
  const params = useLocalSearchParams<{ preview?: string | string[] }>();
  const preview = __DEV__ ? parseSignalerHomePreview(params.preview) : null;
  const { profile, loading, sessionReady } = useRelationship();

  // Block render until role is known — prevents wrong screen flash + hook side effects
  if (!sessionReady || loading) return <LoadingScreen />;
  if (!profile) return <Redirect href="/onboarding" />;
  if (profile.role !== 'signaler') return <Redirect href="/recipient-home" />;

  return <SignalerHomeScreen preview={preview} />;
}
