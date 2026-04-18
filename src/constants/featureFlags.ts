/**
 * Build-time feature flags.
 *
 * Keep this file tiny and boolean-only. Runtime flags (PostHog-driven,
 * user-specific) should go through a separate `useFlag(key)` hook —
 * not this file. This file is for decisions we want codified in the
 * source tree and reviewed in PRs.
 */

/**
 * Multi-pair UI in Settings.
 *
 * Backend + AddPairScreen flow ship behind this gate. With the flag OFF:
 * - the "Zaproś kolejną bliską osobę" CTA in Settings is hidden
 * - /add-pair route stays functional (reachable via direct deep link)
 *   so internal QA can still exercise it
 *
 * Ship blocker for flipping to true (P2.2 sprint):
 * - RecipientHome + SignalerHome still read signalers[0] / recipients[0]
 *   and silently hide any additional pair. Needs multi-status-circle UI.
 * - Onboarding-of-second-signaler has no in-app entry point for
 *   existing cmok users (JoinScreen is one-shot).
 */
export const MULTI_PAIR_ENABLED = false;
