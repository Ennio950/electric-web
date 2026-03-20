import { Redirect, Tabs } from 'expo-router';

import { LoadingScreen } from '@/src/components/LoadingScreen';
import { appRoutes, getRoleHomeRoute, toExpoHref } from '@/src/navigation/routes';
import { useSessionSnapshot } from '@/src/stores/sessionStore';

export default function EmployeeLayout() {
  const session = useSessionSnapshot();

  if (session.isLoading) {
    return <LoadingScreen label="Cargando area employee..." />;
  }

  if (!session.isAuthenticated) {
    return <Redirect href={toExpoHref(appRoutes.authLogin)} />;
  }

  if (session.role !== 'employee') {
    return <Redirect href={toExpoHref(getRoleHomeRoute(session.role))} />;
  }

  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="requests/index" options={{ title: 'Requests' }} />
      <Tabs.Screen name="requests/[id]" options={{ href: null }} />
      <Tabs.Screen name="emergency/new" options={{ title: 'Emergency' }} />
      <Tabs.Screen name="emergency/[id]" options={{ href: null }} />
      <Tabs.Screen name="profile/index" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
