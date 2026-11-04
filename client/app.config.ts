import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * App configuration. Values that differ per environment come from EXPO_PUBLIC_*
 * / build-time env vars (see .env.example) so no secret is ever committed.
 */
const BUNDLE_ID = process.env.APP_BUNDLE_ID ?? 'com.example.namazvakti';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Vakit',
  slug: 'vakit',
  scheme: 'namazvakti',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  backgroundColor: '#0B0F17',
  ios: {
    bundleIdentifier: BUNDLE_ID,
    supportsTablet: true,
    usesAppleSignIn: true,
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        'Namaz vakitlerini, kıble yönünü ve yakındaki camileri bulunduğunuz yere göre göstermek için konumunuz kullanılır.',
      NSMotionUsageDescription: 'Kıble pusulası için cihazınızın yön sensörü kullanılır.',
      UIBackgroundModes: ['remote-notification'],
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: BUNDLE_ID,
    adaptiveIcon: {
      backgroundColor: '#0B0F17',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    permissions: [
      'ACCESS_COARSE_LOCATION',
      'ACCESS_FINE_LOCATION',
      'POST_NOTIFICATIONS',
      'SCHEDULE_EXACT_ALARM',
      'VIBRATE',
    ],
    blockedPermissions: ['ACCESS_BACKGROUND_LOCATION'],
    config: process.env.GOOGLE_MAPS_ANDROID_KEY
      ? { googleMaps: { apiKey: process.env.GOOGLE_MAPS_ANDROID_KEY } }
      : undefined,
    predictiveBackGestureEnabled: false,
  },
  web: {
    output: 'single',
    bundler: 'metro',
    favicon: './assets/favicon.png',
    name: 'Vakit',
    shortName: 'Vakit',
    themeColor: '#0B0F17',
    backgroundColor: '#0B0F17',
    lang: 'tr',
  },
  plugins: [
    'expo-router',
    'expo-font',
    'expo-secure-store',
    'expo-apple-authentication',
    'expo-web-browser',
    'expo-localization',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#0B0F17',
        image: './assets/splash-icon.png',
        imageWidth: 160,
        dark: { backgroundColor: '#0B0F17', image: './assets/splash-icon.png' },
      },
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Namaz vakitlerini, kıble yönünü ve yakındaki camileri bulunduğunuz yere göre göstermek için konumunuz kullanılır.',
        isIosBackgroundLocationEnabled: false,
        isAndroidBackgroundLocationEnabled: false,
      },
    ],
    [
      'expo-notifications',
      {
        color: '#C9A96E',
        defaultChannel: 'vakit',
      },
    ],
    [
      'expo-sensors',
      { motionPermission: 'Kıble pusulası için cihazınızın yön sensörü kullanılır.' },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    eas: process.env.EAS_PROJECT_ID ? { projectId: process.env.EAS_PROJECT_ID } : undefined,
  },
});
