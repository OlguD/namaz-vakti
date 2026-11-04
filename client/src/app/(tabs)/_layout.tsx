import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/tabs';
import { useFlags } from '@/lib/flags';
import { useTheme } from '@/theme/theme';
import { TabBar } from '@/ui/TabBar';

export default function TabsLayout() {
  const { c } = useTheme();
  const onboarded = useFlags((s) => s.onboarded);
  if (!onboarded) return <Redirect href="/onboarding" />;
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: c.bg }, animation: 'fade' }}
    >
      <Tabs.Screen name="index" options={{ title: 'Vakitler' }} />
      <Tabs.Screen name="ibadet" options={{ title: 'İbadet' }} />
      <Tabs.Screen name="kible" options={{ title: 'Kıble' }} />
      <Tabs.Screen name="camiler" options={{ title: 'Camiler' }} />
      <Tabs.Screen name="canli" options={{ title: 'Canlı' }} />
    </Tabs>
  );
}
