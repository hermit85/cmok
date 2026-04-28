import { useState, useEffect } from 'react';
import { Redirect } from 'expo-router';
import { LoadingScreen } from '../src/components/LoadingScreen';
import { useRelationship } from '../src/hooks/useRelationship';
import { prefetchCircle } from '../src/hooks/useCircle';
import { getPendingInvite } from '../src/utils/pendingInvite';

/*
  Runtime state map:
  ┌─────────────────────────────────────────────────────────┐
  │ No session / no profile      → /onboarding             │
  │ Profile + pending invite     → /join/{code}             │
  │ Recipient + pending relation → /waiting                 │
  │ Signaler + no relation       → /onboarding (join step)  │
  │ Recipient + no relation      → /onboarding (setup step) │
  │ Signaler + active            → /signaler-home           │
  │ Recipient + active           → /recipient-home          │
  │ Trusted access only          → /trusted-support         │
  └─────────────────────────────────────────────────────────┘
*/

type Destination = '/onboarding' | '/waiting' | '/signaler-home' | '/recipient-home' | '/trusted-support' | string;

export default function Index() {
  const { loading, sessionReady, profile, status, hasTrustedAccess } = useRelationship();
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [checkedPending, setCheckedPending] = useState(false);

  // Check pending invite as soon as possible (don't wait for sessionReady)
  useEffect(() => {
    getPendingInvite().then((pending) => {
      if (pending) setPendingCode(pending.code);
      setCheckedPending(true);
    });
    // Pre-warm the circle cache in parallel with useRelationship so the
    // destination home route lazy-seeds and skips its inner spinner.
    // Fire-and-forget; failure is harmless (the home will fetch normally).
    prefetchCircle().catch(() => {});
  }, []);

  if (loading || !sessionReady || !checkedPending) {
    return <LoadingScreen />;
  }

  // No profile → full onboarding
  if (!profile) {
    return <Redirect href="/onboarding" />;
  }

  // Active relationship → home (takes priority over stale pending invite)
  if (status === 'active') {
    return <Redirect href={profile.role === 'signaler' ? '/signaler-home' : '/recipient-home'} />;
  }

  // Pending invite code → resume join flow (only if no active relationship)
  if (pendingCode) {
    return <Redirect href={`/join/${pendingCode}`} />;
  }

  // Pending relationship (recipient created invite, waiting for signaler to join)
  if (status === 'pending' && profile.role === 'recipient') {
    return <Redirect href="/waiting" />;
  }

  // Trusted access but no primary relationship
  if (hasTrustedAccess) {
    return <Redirect href="/trusted-support" />;
  }

  // Profile exists but no relationship → back to onboarding
  // (onboarding detects existing profile and skips auth, goes to setup/join)
  return <Redirect href="/onboarding" />;
}
