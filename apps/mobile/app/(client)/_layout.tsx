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
    <Tabs screenOptions={{
      headerShown: false,
      tabBarHideOnKeyboard: true,
      tabBarStyle: {
        backgroundColor: '#080f22',
        borderTopColor: 'rgba(148,163,184,0.15)',
        borderTopWidth: 1,
      },
      tabBarActiveTintColor: '#38bdf8',
      tabBarInactiveTintColor: '#4a6580',
      tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
    }}>
      <Tabs.Screen name="index" options={{ title: 'Panel' }} />
      <Tabs.Screen name="requests/index" options={{ title: 'Solicitudes' }} />
      <Tabs.Screen name="requests/new" options={{ href: null }} />
      <Tabs.Screen name="requests/[id]" options={{ href: null }} />
      <Tabs.Screen name="emergency/index" options={{ title: 'Emergencias' }} />
      <Tabs.Screen name="emergency/new" options={{ href: null }} />
      <Tabs.Screen name="emergency/[id]" options={{ href: null }} />
    </Tabs>
  );
}
