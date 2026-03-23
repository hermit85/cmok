// AppNavigator — role-based navigation logic
// Used by the Expo Router layout to decide which screen to show.
//
// Flow:
//   No user → Onboarding
//   User role = 'senior' → SeniorHomeScreen
//   User role = 'caregiver' → CaregiverDashboardScreen
//   Settings accessible from both roles

export type AppRoute =
  | 'onboarding'
  | 'senior-home'
  | 'caregiver-dashboard'
  | 'settings';

export function getInitialRoute(role: 'senior' | 'caregiver' | null): AppRoute {
  if (!role) return 'onboarding';
  return role === 'senior' ? 'senior-home' : 'caregiver-dashboard';
}
