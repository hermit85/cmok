import PostHog from 'posthog-react-native';

export const posthog = new PostHog(
  'phc_pmETK33VvQDm8MiPAcMoVWTUqogdDcDRscU4gkGMfugF',
  {
    host: 'https://eu.i.posthog.com',
    flushInterval: 30000,
    flushAt: 20,
    captureAppLifecycleEvents: true,
    enableExceptionAutocapture: true,
  },
);
