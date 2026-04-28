import { existsSync } from 'node:fs';
import type { ExpoConfig } from 'expo/config';

const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID || process.env.EAS_PROJECT_ID;
const googleServicesPath = process.env.GOOGLE_SERVICES_JSON || './google-services.json';
const hasGoogleServicesFile = existsSync(googleServicesPath);

const config: ExpoConfig = {
  // Brand rule: lowercase 'cmok' everywhere. iOS home-screen label +
  // App Store display name both read from this field.
  name: 'cmok',
  slug: 'cmok',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  scheme: 'cmok',
  platforms: ['ios', 'android', 'web'],
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#F7F3EE',
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.hermit85.cmok',
    buildNumber: '29',
    // Universal Links (Associated Domains capability) temporarily disabled
    // for build 26. Blocked by two infra prereqs that aren't ready yet:
    //   1. apple-app-site-association file served from cmok.app
    //   2. Associated Domains capability enabled on the App ID + regenerated
    //      provisioning profile (needs interactive `eas credentials` + Apple
    //      Developer login to reauthorize the capability)
    // Until both land, https://cmok.app/join/{code} will fall through to the
    // landing page instead of opening the app directly — acceptable for the
    // first iteration of the viral share flow.
    //
    // Re-enable with: associatedDomains: ['applinks:cmok.app'],
    infoPlist: {
      NSLocationWhenInUseUsageDescription: 'cmok może dołączyć Twoją lokalizację, gdy chcesz dać znać bliskim, że coś się dzieje.',
      // cmok uses only standard iOS HTTPS — no custom cryptography. Declaring
      // this up-front skips the "Missing Compliance" block in App Store Connect
      // so builds go straight to TestFlight without manual export-compliance
      // clicking. (Build 26 still needs the click; build 27+ won't.)
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: 'com.hermit85.cmok',
    // Android keeps its own monotonically increasing build counter for
    // Google Play. Do not reuse iOS buildNumber here.
    versionCode: 1,
    ...(hasGoogleServicesFile ? { googleServicesFile: googleServicesPath } : {}),
    adaptiveIcon: {
      backgroundColor: '#F7F3EE',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    // Android App Links temporarily disabled for build 27 — mirror of iOS
    // Associated Domains decision. Needs matching /.well-known/assetlinks.json
    // on cmok.app (currently 404). Re-enable alongside the iOS AASA once
    // cmok-web deploys both files:
    //   intentFilters: [{
    //     action: 'VIEW', autoVerify: true, category: ['BROWSABLE', 'DEFAULT'],
    //     data: [{ scheme: 'https', host: 'cmok.app', pathPrefix: '/join' }],
    //   }],
    permissions: ['ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION'],
  },
  web: {
    bundler: 'metro',
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-router',
    [
      'expo-notifications',
      {
        icon: './assets/icon.png',
        color: '#6F8F72',
      },
    ],
    'expo-secure-store',
    [
      'expo-location',
      {
        locationWhenInUsePermission: 'cmok może dołączyć Twoją lokalizację, gdy chcesz dać znać bliskim, że coś się dzieje.',
      },
    ],
    'expo-font',
    ['@sentry/react-native', { organization: 'cybird-consulting', project: 'cmok' }],
    // expo-tracking-transparency removed 2026-04-19. cmok does not use
    // IDFA / cross-app tracking; the ATT prompt was inconsistent with the
    // privacy manifest (NSPrivacyTracking=false) and triggered App Store
    // review flagging. Re-add deliberately only if we ship cross-app
    // tracking later.
  ],
  extra: {
    eas: {
      projectId: 'c5630e5a-06ae-4f6f-a53f-a74fad723899',
    },
  },
};

export default config;
