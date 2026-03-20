import { Redirect } from 'expo-router';
import { Platform } from 'react-native';

import { LoadingScreen } from '@/src/components/LoadingScreen';
import { appRoutes, toExpoHref } from '@/src/navigation/routes';
import { useSessionSnapshot } from '@/src/stores/sessionStore';

export default function IndexScreen() {
  const session = useSessionSnapshot();

  if (session.isLoading) {
    if (Platform.OS === 'web') {
      return <Redirect href={toExpoHref(appRoutes.authLogin)} />;
    }

    return <LoadingScreen label="Preparando sesion..." />;
  }

  if (!session.isAuthenticated) {
    return <Redirect href={toExpoHref(appRoutes.authLogin)} />;
  }

  if (session.role === 'boss') {
    return <Redirect href={toExpoHref(appRoutes.bossHome)} />;
  }

  if (session.role === 'employee') {
    return <Redirect href={toExpoHref(appRoutes.employeeHome)} />;
  }

  return <Redirect href={toExpoHref(appRoutes.clientHome)} />;
}
