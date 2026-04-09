import { useLocalSearchParams } from 'expo-router';
import { RecipientHomeScreen } from '../src/screens/RecipientHomeScreen';
import { parseRecipientHomePreview } from '../src/dev/homePreview';

export default function RecipientHome() {
  const params = useLocalSearchParams<{ preview?: string | string[] }>();
  const preview = __DEV__ ? parseRecipientHomePreview(params.preview) : null;

  return <RecipientHomeScreen preview={preview} />;
}
