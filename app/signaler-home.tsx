import { useLocalSearchParams } from 'expo-router';
import { SignalerHomeScreen } from '../src/screens/SignalerHomeScreen';
import { parseSignalerHomePreview } from '../src/dev/homePreview';

export default function SignalerHome() {
  const params = useLocalSearchParams<{ preview?: string | string[] }>();
  const preview = __DEV__ ? parseSignalerHomePreview(params.preview) : null;

  return <SignalerHomeScreen preview={preview} />;
}
