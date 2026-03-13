import { Redirect } from 'expo-router';
import { useAppStore } from '../src/store/useAppStore';

export default function Index() {
  const memberId = useAppStore((s) => s.memberId);

  if (memberId) {
    return <Redirect href="/home" />;
  }

  return <Redirect href="/onboarding" />;
}
