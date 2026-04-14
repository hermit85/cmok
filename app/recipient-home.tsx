import { useLocalSearchParams, Redirect } from 'expo-router';
import { RecipientHomeScreen } from '../src/screens/RecipientHomeScreen';
import { parseRecipientHomePreview } from '../src/dev/homePreview';
import { useRelationship } from '../src/hooks/useRelationship';

export default function RecipientHome() {
  const params = useLocalSearchParams<{ preview?: string | string[] }>();
  const preview = __DEV__ ? parseRecipientHomePreview(params.preview) : null;
  const { profile, loading } = useRelationship();

  // Role guard: redirect signalers away from recipient screen
  if (!loading && profile && profile.role !== 'recipient') {
    return <Redirect href="/signaler-home" />;
  }

  return <RecipientHomeScreen preview={preview} />;
}
