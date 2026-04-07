import { Redirect, Tabs } from 'expo-router';

import { LoadingScreen } from '@/src/components/LoadingScreen';
import { appRoutes, getRoleHomeRoute, toExpoHref } from '@/src/navigation/routes';
import { useSessionSnapshot } from '@/src/stores/sessionStore';

export default function BossLayout() {
  const session = useSessionSnapshot();

  if (session.isLoading) {
    return <LoadingScreen label="Cargando area boss..." />;
  }

  if (!session.isAuthenticated) {
    return <Redirect href={toExpoHref(appRoutes.authLogin)} />;
  }

  if (session.role !== 'boss') {
    return <Redirect href={toExpoHref(getRoleHomeRoute(session.role))} />;
  }

  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="queue/index" options={{ title: 'Queue' }} />
      <Tabs.Screen name="queue/[id]" options={{ href: null }} />
      <Tabs.Screen name="payments/index" options={{ title: 'Payments' }} />
      <Tabs.Screen name="payments/[id]" options={{ href: null }} />
      <Tabs.Screen name="schedule/index" options={{ title: 'Agenda' }} />
      <Tabs.Screen name="admin/index" options={{ title: 'Admin' }} />
      <Tabs.Screen name="settings/index" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
