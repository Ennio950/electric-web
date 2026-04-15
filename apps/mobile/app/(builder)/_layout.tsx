import { Redirect, Stack } from 'expo-router';

import { LoadingScreen } from '@/src/components/LoadingScreen';
import { appRoutes, getRoleHomeRoute, toExpoHref } from '@/src/navigation/routes';
import { useSessionStore, useSessionSnapshot } from '@/src/stores/sessionStore';

export default function BuilderLayout() {
  const session = useSessionSnapshot();
  const bootstrap = useSessionStore((state) => state.bootstrap);

  if (session.isLoading) {
    return <LoadingScreen label="Abriendo builder..." />;
  }

  if (!session.isAuthenticated) {
    return <Redirect href={toExpoHref(appRoutes.authLogin)} />;
  }

  if (!bootstrap?.featureFlags.builderMobile) {
    return <Redirect href={toExpoHref(getRoleHomeRoute(session.role))} />;
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: '#10233F'
        },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: {
          fontWeight: '700'
        },
        contentStyle: {
          backgroundColor: '#F4F7FB'
        }
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Estimados' }} />
      <Stack.Screen name="materials" options={{ title: 'Materiales' }} />
      <Stack.Screen name="recipes" options={{ title: 'Recetas' }} />
      <Stack.Screen name="estimate-history" options={{ title: 'Historial de estimados' }} />
      <Stack.Screen name="estimate-detail/[id]" options={{ title: 'Detalle del estimado' }} />
      <Stack.Screen name="invoice/new" options={{ title: 'Nueva factura' }} />
      <Stack.Screen name="jobs/[id]" options={{ title: 'Editar estimado' }} />
      <Stack.Screen name="estimate-preview/[id]" options={{ title: 'Vista previa' }} />
    </Stack>
  );
}
