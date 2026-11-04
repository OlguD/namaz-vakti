import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { persister, queryClient, setupQueryEnvironment, shouldPersist } from '@/api/query';
import { bootSession } from '@/auth/session';
import { hydratePlace } from '@/features/location/store';
import { NotificationsBridge } from '@/features/notifications';
import { hydrateFlags } from '@/lib/flags';
import { FONT_ASSETS } from '@/theme/fonts';
import { ThemeProvider, useTheme } from '@/theme/theme';

void SplashScreen.preventAutoHideAsync().catch(() => {});

export { ErrorBoundary } from '@/ui/ErrorBoundary';

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(FONT_ASSETS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const teardown = setupQueryEnvironment();
    void Promise.all([hydratePlace(), hydrateFlags()]).finally(() => setHydrated(true));
    void bootSession();
    return teardown;
  }, []);

  const ready = (fontsLoaded || !!fontError) && hydrated;
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  return (
    <SafeAreaProvider>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister,
          maxAge: 7 * 24 * 3600_000,
          // Bump when cached response shapes change.
          buster: 'v1',
          dehydrateOptions: {
            shouldDehydrateQuery: (q) => q.state.status === 'success' && shouldPersist(q.queryKey),
          },
        }}
      >
        <ThemeProvider>
          {ready ? (
            <>
              <AppStack />
              <NotificationsBridge />
            </>
          ) : (
            <Blank />
          )}
        </ThemeProvider>
      </PersistQueryClientProvider>
    </SafeAreaProvider>
  );
}

function Blank() {
  const { c } = useTheme();
  return <View style={{ flex: 1, backgroundColor: c.bg }} />;
}

function AppStack() {
  const { c } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: c.bg },
        animation: 'fade_from_bottom',
      }}
    >
      <Stack.Screen name="(tabs)" options={{ animation: 'none' }} />
      <Stack.Screen name="onboarding" options={{ animation: 'fade', gestureEnabled: false }} />
    </Stack>
  );
}
