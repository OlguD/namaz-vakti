import { Platform } from 'react-native';

/** Backend origin, e.g. https://api.example.com (no trailing slash). */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000').replace(
  /\/+$/,
  '',
);

export const IS_WEB = Platform.OS === 'web';

export const PLATFORM = (Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web') as
  | 'ios'
  | 'android'
  | 'web';

export const PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL ?? 'https://example.com/gizlilik';
export const TERMS_URL = process.env.EXPO_PUBLIC_TERMS_URL ?? 'https://example.com/kosullar';
