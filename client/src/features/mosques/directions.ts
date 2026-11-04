import { Linking, Platform } from 'react-native';

/** Opens walking directions in the platform's maps app (Google Maps on the web). */
export async function openDirections(dest: { lat: number; lng: number; name?: string | null }): Promise<void> {
  const ll = `${dest.lat},${dest.lng}`;
  const web = `https://www.google.com/maps/dir/?api=1&destination=${ll}&travelmode=walking`;
  // Universal links: no Info.plist / <queries> entries needed, and they hand
  // off to Apple Maps / Google Maps when installed.
  const native =
    Platform.OS === 'ios'
      ? `https://maps.apple.com/?daddr=${ll}&dirflg=w`
      : Platform.OS === 'android'
        ? `google.navigation:q=${ll}&mode=w`
        : null;
  if (native) {
    try {
      await Linking.openURL(native);
      return;
    } catch {
      // No Google Maps app: fall through to the web URL.
    }
  }
  await Linking.openURL(web);
}

export function callPhone(phone: string): void {
  void Linking.openURL(`tel:${phone.replace(/[^\d+]/g, '')}`);
}

export function openWebsite(url: string): void {
  void Linking.openURL(/^https?:\/\//.test(url) ? url : `https://${url}`);
}
