import { Redirect, Stack } from 'expo-router';
import { Platform } from 'react-native';

import { LoadingScreen } from '@/src/components/LoadingScreen';
import { getRoleHomeRoute, toExpoHref } from '@/src/navigation/routes';
import { useSessionSnapshot, useSessionStore } from '@/src/stores/sessionStore';

export default function AuthLayout() {
  const session = useSessionSnapshot();
  const authFlow = useSessionStore((state) => state.authFlow);
  const shouldRenderLoading = session.isLoading && authFlow === 'idle' && Platform.OS !== 'web';

  if (shouldRenderLoading) {
    return <LoadingScreen label="Recuperando sesion..." />;
  }

  if (session.isAuthenticated && authFlow === 'idle') {
    return <Redirect href={toExpoHref(getRoleHomeRoute(session.role))} />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="login-client" />
      <Stack.Screen name="login-employee" />
      <Stack.Screen name="login-admin" />
      <Stack.Screen name="magic-client" />
      <Stack.Screen name="signup-client" />
      <Stack.Screen name="apply-employee" />
    </Stack>
  );
}
