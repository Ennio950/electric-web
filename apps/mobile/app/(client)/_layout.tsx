import { Redirect, Tabs } from 'expo-router';

import { LoadingScreen } from '@/src/components/LoadingScreen';
import { appRoutes, getRoleHomeRoute, toExpoHref } from '@/src/navigation/routes';
import { useSessionSnapshot } from '@/src/stores/sessionStore';

export default function ClientLayout() {
  const session = useSessionSnapshot();

  if (session.isLoading) {
    return <LoadingScreen label="Cargando area client..." />;
  }

  if (!session.isAuthenticated) {
    return <Redirect href={toExpoHref(appRoutes.authLogin)} />;
  }

  if (session.role !== 'client') {
    return <Redirect href={toExpoHref(getRoleHomeRoute(session.role))} />;
  }

  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="requests/index" options={{ title: 'Requests' }} />
      <Tabs.Screen name="requests/new" options={{ title: 'Nueva' }} />
      <Tabs.Screen name="requests/[id]" options={{ href: null }} />
      <Tabs.Screen name="emergency/index" options={{ title: 'Emergencias' }} />
      <Tabs.Screen name="emergency/new" options={{ title: 'Nueva emergencia' }} />
      <Tabs.Screen name="emergency/[id]" options={{ href: null }} />
    </Tabs>
  );
}
