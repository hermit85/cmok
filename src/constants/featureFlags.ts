/**
 * Feature flags — central config for gating features.
 * Flip these during development/testing without touching component code.
 */
export const FeatureFlags = {
  /** Allow users to sign up without an invite code (organic discovery). */
  ALLOW_ORGANIC_SIGNUP: false,
} as const;
