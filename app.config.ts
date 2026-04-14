import type { ExpoConfig } from 'expo/config';

const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID || process.env.EAS_PROJECT_ID;

const config: ExpoConfig = {
  name: 'Cmok',
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
    buildNumber: '12',
    infoPlist: {
      NSLocationWhenInUseUsageDescription: 'Cmok może dołączyć Twoją lokalizację, gdy chcesz dać znać bliskim, że coś się dzieje.',
    },
  },
  android: {
    package: 'com.hermit85.cmok',
    adaptiveIcon: {
      backgroundColor: '#F7F3EE',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
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
        locationWhenInUsePermission: 'Cmok może dołączyć Twoją lokalizację, gdy chcesz dać znać bliskim, że coś się dzieje.',
      },
    ],
    'expo-font',
    ['@sentry/react-native', { organization: 'cybird-consulting', project: 'cmok' }],
  ],
  extra: {
    eas: {
      projectId: 'c5630e5a-06ae-4f6f-a53f-a74fad723899',
    },
  },
};

export default config;
