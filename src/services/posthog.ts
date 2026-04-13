import PostHog from 'posthog-react-native';

export const posthog = new PostHog(
  'phc_pmETK33VvQDm8MiPAcMoVWTUqogdDcDRscU4gkGMfugF',
  {
    host: 'https://eu.i.posthog.com',
    // Flush events every 30s or 20 events
    flushInterval: 30000,
    flushAt: 20,
    // Disable automatic capture of screens (we'll do it manually for meaningful events)
    captureAppLifecycleEvents: true,
  },
);
