import { useQuery } from '@tanstack/react-query';
import { Text, View } from 'react-native';

import { DashboardScreen } from '@/src/components/DashboardScreen';
import { PressableCard } from '@/src/components/PressableCard';
import { SectionCard } from '@/src/components/SectionCard';
import { SignOutButton } from '@/src/components/SignOutButton';
import { useMobileHomeQuery } from '@/src/hooks/useMobileHomeQuery';
import { fetchClientRequests, fetchEmergencyCalls, withCurrentToken } from '@/src/lib/api';
import { formatDateTime, formatEmergencyStatus, formatRequestStatus } from '@/src/lib/formatters';
import { appRoutes, pushAppRoute } from '@/src/navigation/routes';
import { useSessionStore } from '@/src/stores/sessionStore';

export default function ClientHomeScreen() {
  const bootstrap = useSessionStore((state) => state.bootstrap);
  const homeQuery = useMobileHomeQuery();
  const requestsQuery = useQuery({
    queryKey: ['client-requests'],
    enabled: Boolean(bootstrap),
    queryFn: () => withCurrentToken(fetchClientRequests),
  });
  const emergencyQuery = useQuery({
    queryKey: ['client-emergency-calls'],
    enabled: Boolean(bootstrap),
    queryFn: () => withCurrentToken((token) => fetchEmergencyCalls(token, { mode: 'all' })),
  });

  if (!bootstrap) {
    return null;
  }

  const summary = homeQuery.data?.role === 'client'
    ? homeQuery.data.summary
    : {
        totalRequests: 0,
        activeRequests: 0,
        awaitingMyAction: 0,
        completedRequests: 0,
      };

  const recentRequests = (requestsQuery.data ?? []).slice(0, 3);

  return (
    <DashboardScreen
      title="Cliente operativo"
      subtitle="Tu panel nativo para crear solicitudes, seguir el trabajo y cerrar pagos."
      role="client"
      companyName={bootstrap.companyConfig.companyName}
      stats={[
        { label: 'Solicitudes', value: summary.totalRequests },
        { label: 'Activas', value: summary.activeRequests },
        { label: 'Accion tuya', value: summary.awaitingMyAction },
        { label: 'Completadas', value: summary.completedRequests },
      ]}
      isLoading={homeQuery.isLoading || requestsQuery.isLoading || emergencyQuery.isLoading}
      errorMessage={
        homeQuery.error instanceof Error
          ? homeQuery.error.message
          : requestsQuery.error instanceof Error
            ? requestsQuery.error.message
            : emergencyQuery.error instanceof Error
              ? emergencyQuery.error.message
            : null
      }
      footer={(
        <View style={{ gap: 16 }}>
          <SectionCard
            title="Accesos rapidos"
            subtitle="Cliente ya entra por el mismo login y usa los requests reales del marketplace."
          >
            <PressableCard
              eyebrow="Nueva solicitud"
              title="Crear un request"
              subtitle="Abre un servicio nuevo con direccion, descripcion y foto."
              onPress={() => pushAppRoute(appRoutes.clientRequestsNew)}
            />
            <PressableCard
              eyebrow="Seguimiento"
              title="Ver mis requests"
              subtitle="Historial, estados y acciones pendientes."
              onPress={() => pushAppRoute(appRoutes.clientRequests)}
            />
            <PressableCard
              eyebrow="Urgencias"
              title="Emergencias"
              subtitle="Crear una emergencia y seguirla en tiempo real."
              onPress={() => pushAppRoute(appRoutes.clientEmergency)}
            />
            {bootstrap.featureFlags.builderMobile ? (
              <PressableCard
                eyebrow="Estimator"
                title="Abrir builder"
                subtitle="Crear jobs, materiales y recetas desde el móvil."
                onPress={() => pushAppRoute(appRoutes.builderHome)}
              />
            ) : null}
          </SectionCard>

          <SectionCard
            title="Recientes"
            subtitle="Ultimas solicitudes ligadas a tu cuenta."
          >
            {recentRequests.length ? recentRequests.map((request) => (
              <PressableCard
                key={request.id}
                eyebrow={formatRequestStatus(request.status)}
                title={request.address || 'Solicitud sin direccion'}
                subtitle={request.description || 'Sin descripcion'}
                meta={formatDateTime(request.createdAt, bootstrap.companyConfig.locale, bootstrap.companyConfig.timezone)}
                onPress={() => pushAppRoute(appRoutes.clientRequestDetail(request.id))}
              />
            )) : <Text style={{ fontSize: 14, color: '#6B778C' }}>Todavia no tienes solicitudes.</Text>}
          </SectionCard>

          <SectionCard
            title="Emergencias"
            subtitle="Tus ultimas llamadas de emergencia o trabajos programados."
          >
            {(emergencyQuery.data ?? []).slice(0, 3).length ? (emergencyQuery.data ?? []).slice(0, 3).map((call) => (
              <PressableCard
                key={call.id}
                eyebrow={formatEmergencyStatus(call.status)}
                title={call.location || 'Emergencia sin ubicacion'}
                subtitle={call.issue || 'Sin detalle'}
                meta={formatDateTime(call.updatedAt || call.createdAt, bootstrap.companyConfig.locale, bootstrap.companyConfig.timezone)}
                onPress={() => pushAppRoute(appRoutes.clientEmergencyDetail(call.id))}
              />
            )) : <Text style={{ fontSize: 14, color: '#6B778C' }}>Todavia no tienes emergencias.</Text>}
          </SectionCard>

          <SignOutButton />
        </View>
      )}
    />
  );
}
