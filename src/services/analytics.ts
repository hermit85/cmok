/**
 * cmok analytics events — PostHog wrapper.
 *
 * Key events tracked:
 * - Onboarding funnel (start, intent, phone, verify, join, complete)
 * - Daily check-in (the core action)
 * - Reactions sent/received
 * - Urgent signal triggered
 * - Circle management (invite, add contact)
 * - Retention signals (streak milestones)
 */

import { posthog } from './posthog';

export const analytics = {
  // ── Onboarding ──
  onboardingStarted: () =>
    posthog.capture('onboarding_started'),

  onboardingIntent: (role: string) =>
    posthog.capture('onboarding_intent', { role }),

  onboardingPhoneSent: () =>
    posthog.capture('onboarding_phone_sent'),

  onboardingVerified: (hasProfile: boolean, relationshipStatus: string) =>
    posthog.capture('onboarding_verified', { has_profile: hasProfile, relationship_status: relationshipStatus }),

  onboardingCompleted: (role: string) =>
    posthog.capture('onboarding_completed', { role }),

  // ── Core actions ──
  checkinSent: (streak: number) =>
    posthog.capture('checkin_sent', { streak }),

  reactionSent: (emoji: string) =>
    posthog.capture('reaction_sent', { emoji }),

  morningThoughtSent: (emoji: string) =>
    posthog.capture('morning_thought_sent', { emoji }),

  pokeSent: (emoji: string) =>
    posthog.capture('poke_sent', { emoji }),

  nudgeSent: () =>
    posthog.capture('nudge_sent'),

  // ── Urgent ──
  urgentTriggered: (withLocation: boolean) =>
    posthog.capture('urgent_triggered', { with_location: withLocation }),

  urgentClaimed: () =>
    posthog.capture('urgent_claimed'),

  urgentResolved: () =>
    posthog.capture('urgent_resolved'),

  // ── Circle ──
  inviteShared: (type: 'main' | 'circle' | 'peer_senior' | 'peer_family' | 'peer_general') =>
    posthog.capture('invite_shared', { type }),

  contactAdded: () =>
    posthog.capture('contact_added'),

  contactRemoved: () =>
    posthog.capture('contact_removed'),

  // ── Milestones ──
  milestoneReached: (streak: number, perspective?: 'signaler' | 'recipient') => {
    const props: Record<string, string | number> = { streak };
    if (perspective) props.perspective = perspective;
    posthog.capture('milestone_reached', props);
  },

  /**
   * Fires when a milestone celebration triggers a successful share.
   * `perspective` tells us who shared (signaler vs recipient, the
   * recipient side has different demo and likely different K).
   * `variant` mirrors the shareType string we embed in the URL (e.g.
   * `milestone_recipient_30d`) so we can join share events with
   * install_via_invite attributions downstream.
   */
  milestoneShared: (streak: number, perspective?: 'signaler' | 'recipient', variant?: string) => {
    const props: Record<string, string | number> = { streak };
    if (perspective) props.perspective = perspective;
    if (variant) props.variant = variant;
    posthog.capture('milestone_shared', props);
  },

  // ── Settings ──
  nameChanged: () =>
    posthog.capture('name_changed'),

  accountDeleted: () =>
    posthog.capture('account_deleted'),

  loggedOut: () =>
    posthog.capture('logged_out'),

  // ── Screens ──
  screenViewed: (screen: string) =>
    posthog.capture('$screen', { $screen_name: screen }),
};
