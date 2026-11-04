import type { ErrorBoundaryProps } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

/**
 * Route-level crash screen. Uses no theme/context on purpose: the provider
 * tree itself may be what failed.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={{ flex: 1, backgroundColor: '#0B0F17', justifyContent: 'center', padding: 24, gap: 16 }}>
      <Text accessibilityRole="header" style={{ color: '#F3EEE4', fontSize: 24, lineHeight: 30 }}>
        Bir şeyler ters gitti
      </Text>
      <Text style={{ color: '#A9A59C', fontSize: 15, lineHeight: 22 }}>
        Ekran yüklenirken beklenmeyen bir hata oluştu. Tekrar denemek çoğu zaman yeterli olur.
      </Text>
      {__DEV__ ? <Text style={{ color: '#85827B', fontSize: 12 }}>{error.message}</Text> : null}
      <Pressable
        onPress={retry}
        accessibilityRole="button"
        style={{ minHeight: 54, borderRadius: 16, backgroundColor: '#C9A96E', alignItems: 'center', justifyContent: 'center' }}
      >
        <Text style={{ color: '#1A1408', fontSize: 16, fontWeight: '600' }}>Tekrar dene</Text>
      </Pressable>
    </View>
  );
}
