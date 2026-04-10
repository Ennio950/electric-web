import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';

import { LoadingScreen } from '@/src/components/LoadingScreen';
import { appRoutes, getRoleHomeRoute, toExpoHref } from '@/src/navigation/routes';
import { useSessionSnapshot } from '@/src/stores/sessionStore';

const TAB_CONFIG: Record<string, { title: string; icon: keyof typeof Ionicons.glyphMap }> = {
  'index': { title: 'Inicio', icon: 'grid-outline' },
  'queue/index': { title: 'Cola', icon: 'git-network-outline' },
  'payments/index': { title: 'Pagos', icon: 'card-outline' },
  'schedule/index': { title: 'Agenda', icon: 'calendar-clear-outline' },
};

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
    <Tabs
      screenOptions={({ route }) => {
        const config = TAB_CONFIG[route.name];
        return {
          headerShown: false,
          sceneStyle: {
            backgroundColor: '#050816',
          },
          tabBarStyle: {
            height: 72,
            paddingTop: 8,
            paddingBottom: 10,
            backgroundColor: '#071120',
            borderTopColor: 'rgba(148,163,184,0.16)',
            borderTopWidth: 1,
          },
          tabBarItemStyle: {
            paddingVertical: 2,
          },
          tabBarActiveTintColor: '#7dd3fc',
          tabBarInactiveTintColor: '#58718b',
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '700',
            marginTop: 2,
          },
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              color={color}
              name={config?.icon ?? 'ellipse-outline'}
              size={focused ? size + 1 : size}
            />
          ),
          title: config?.title,
        };
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Inicio' }} />
      <Tabs.Screen name="queue/index" options={{ title: 'Cola' }} />
      <Tabs.Screen name="queue/[id]" options={{ href: null }} />
      <Tabs.Screen name="payments/index" options={{ title: 'Pagos' }} />
      <Tabs.Screen name="payments/[id]" options={{ href: null }} />
      <Tabs.Screen name="schedule/index" options={{ title: 'Agenda' }} />
      <Tabs.Screen name="admin/index" options={{ href: null }} />
      <Tabs.Screen name="settings/index" options={{ href: null }} />
    </Tabs>
  );
}
