import * as Clipboard from 'expo-clipboard';
import { Platform, Share } from 'react-native';

/**
 * Opens the system share sheet (native, or Web Share API). Where sharing is
 * unavailable (desktop browsers) the text is copied instead.
 * Resolves to what happened so the caller can confirm it to the user.
 */
export async function shareText(message: string, title?: string): Promise<'shared' | 'copied' | 'dismissed'> {
  const canWebShare = Platform.OS !== 'web' || (typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  if (canWebShare) {
    try {
      const res = await Share.share(Platform.OS === 'ios' ? { message } : { message, title });
      return res.action === Share.dismissedAction ? 'dismissed' : 'shared';
    } catch {
      // fall through to copying
    }
  }
  await Clipboard.setStringAsync(message);
  return 'copied';
}
