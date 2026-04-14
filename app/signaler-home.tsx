import { useLocalSearchParams, Redirect } from 'expo-router';
import { SignalerHomeScreen } from '../src/screens/SignalerHomeScreen';
import { parseSignalerHomePreview } from '../src/dev/homePreview';
import { useRelationship } from '../src/hooks/useRelationship';

export default function SignalerHome() {
  const params = useLocalSearchParams<{ preview?: string | string[] }>();
  const preview = __DEV__ ? parseSignalerHomePreview(params.preview) : null;
  const { profile, loading } = useRelationship();

  // Role guard: redirect recipients away from signaler screen
  if (!loading && profile && profile.role !== 'signaler') {
    return <Redirect href="/recipient-home" />;
  }

  return <SignalerHomeScreen preview={preview} />;
}
