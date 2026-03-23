import { Redirect } from 'expo-router';

// TODO: check auth state and role to decide initial route
// For now, always go to onboarding
export default function Index() {
  return <Redirect href="/onboarding" />;
}
