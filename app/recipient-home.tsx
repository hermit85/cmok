import { useLocalSearchParams, Redirect } from 'expo-router';
import { RecipientHomeScreen } from '../src/screens/RecipientHomeScreen';
import { parseRecipientHomePreview } from '../src/dev/homePreview';
import { useRelationship } from '../src/hooks/useRelationship';
import { LoadingScreen } from '../src/components/LoadingScreen';

export default function RecipientHome() {
  const params = useLocalSearchParams<{ preview?: string | string[] }>();
  const preview = __DEV__ ? parseRecipientHomePreview(params.preview) : null;
  const { profile, loading, sessionReady } = useRelationship();

  // Block render until role is known — prevents wrong screen flash + hook side effects
  if (!sessionReady || loading || !profile) return <LoadingScreen />;
  if (profile.role !== 'recipient') return <Redirect href="/signaler-home" />;

  return <RecipientHomeScreen preview={preview} />;
}
