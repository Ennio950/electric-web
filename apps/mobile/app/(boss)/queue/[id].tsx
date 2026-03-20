import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { Link, useLocalSearchParams } from 'expo-router';
import { Linking, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/src/components/AppButton';
import { KeyValueList } from '@/src/components/KeyValueList';
import { LoadingScreen } from '@/src/components/LoadingScreen';
import { OperationalChatCard } from '@/src/components/OperationalChatCard';
import { PressableCard } from '@/src/components/PressableCard';
import { SectionCard } from '@/src/components/SectionCard';
import {
  assignEmergencyToEmployee,
  assignRequestToEmployee,
  fetchBossEmployees,
  fetchEmergencyDetail,
  fetchRequestDetail,
  unassignRequestByBoss,
  withCurrentToken
} from '@/src/lib/api';
import {
  formatCurrency,
  formatDateTime,
  formatEmergencyStatus,
  formatQueueSourceType,
  formatRequestStatus,
} from '@/src/lib/formatters';
import { useSessionStore } from '@/src/stores/sessionStore';
import type { EmployeeDirectoryItem } from '@/src/types/api';

export default function BossQueueDetailScreen() {
  const params = useLocalSearchParams<{ id?: string; sourceType?: string }>();
  const recordId = typeof params.id === 'string' ? params.id : '';
  const sourceType = params.sourceType === 'emergency' ? 'emergency' : 'request';
  const bootstrap = useSessionStore((state) => state.bootstrap);
  const queryClient = useQueryClient();

  const requestQuery = useQuery({
    queryKey: ['boss-queue-detail', 'request', recordId],
    enabled: Boolean(recordId) && sourceType === 'request',
    queryFn: () => withCurrentToken((token) => fetchRequestDetail(token, recordId)),
  });

  const emergencyQuery = useQuery({
    queryKey: ['boss-queue-detail', 'emergency', recordId],
    enabled: Boolean(recordId) && sourceType === 'emergency',
    queryFn: () => withCurrentToken((token) => fetchEmergencyDetail(token, recordId)),
  });

  const employeesQuery = useQuery({
    queryKey: ['boss-employees'],
    queryFn: () => withCurrentToken(fetchBossEmployees),
  });

  const requestAssignMutation = useMutation({
    mutationFn: (employeeId: string) => withCurrentToken((token) => assignRequestToEmployee(token, recordId, employeeId)),
    onSuccess: async () => {
      await invalidateQueueQueries(queryClient, 'request', recordId);
    },
  });

  const emergencyAssignMutation = useMutation({
    mutationFn: (employeeId: string) => withCurrentToken((token) => assignEmergencyToEmployee(token, recordId, employeeId)),
    onSuccess: async () => {
      await invalidateQueueQueries(queryClient, 'emergency', recordId);
    },
  });

  const requestUnassignMutation = useMutation({
    mutationFn: () => withCurrentToken((token) => unassignRequestByBoss(token, recordId)),
    onSuccess: async () => {
      await invalidateQueueQueries(queryClient, 'request', recordId);
    },
  });

  if (!bootstrap || !recordId) {
    return <LoadingScreen label="Cargando detalle..." />;
  }

  if (sourceType === 'emergency') {
    if (emergencyQuery.isLoading) {
      return <LoadingScreen label="Cargando detalle..." />;
    }

    if (emergencyQuery.error || !emergencyQuery.data) {
      return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
          <SectionCard
            title="No se pudo cargar el item"
            subtitle={emergencyQuery.error instanceof Error ? emergencyQuery.error.message : 'Intenta de nuevo.'}
          />
        </ScrollView>
      );
    }

    const call = emergencyQuery.data;
    const companyConfig = bootstrap.companyConfig;
    const currentUserId = bootstrap.user.uid;

    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={emergencyQuery.isRefetching} onRefresh={() => void emergencyQuery.refetch()} />}
      >
        <SectionCard title={call.location || 'Emergencia'} subtitle={call.issue || 'Sin detalle'}>
          <Text style={styles.eyebrow}>{formatQueueSourceType(sourceType)}</Text>
          <Text style={styles.status}>{formatEmergencyStatus(call.status)}</Text>
        </SectionCard>

        <SectionCard title="Resumen">
          <KeyValueList
            items={[
              { label: 'Cliente', value: call.clientName || call.clientEmail || 'Sin dato' },
              { label: 'Tecnico', value: call.assignedEmployeeName || call.assignedEmployeeEmail || 'Sin asignar' },
              { label: 'Telefono', value: call.phone || 'Sin telefono' },
              { label: 'Creado', value: formatDateTime(call.createdAt, companyConfig.locale, companyConfig.timezone) },
              { label: 'Monto', value: formatCurrency(call.finalAmount ?? call.quotedAmount, companyConfig.currency, companyConfig.locale) },
            ]}
          />
        </SectionCard>

        <SectionCard title="Acciones">
          {call.paymentProofUrl ? (
            <AppButton tone="secondary" onPress={() => void Linking.openURL(call.paymentProofUrl ?? '')}>
              Ver comprobante
            </AppButton>
          ) : null}
          {call.status === 'payment_pending_review' ? (
            <Link
              href={{
                pathname: '/(boss)/payments/[id]',
                params: { id: recordId, sourceType: 'emergency' },
              }}
              style={styles.link}
            >
              Ir a revision de pago
            </Link>
        ) : (
            <Text style={styles.muted}>Puedes asignar tecnico abajo o abrir revision si ya hay comprobante.</Text>
          )}
        </SectionCard>

        {!call.assignedEmployeeId && call.status === 'pending' ? (
          <AssignEmployeeSection
            employees={employeesQuery.data ?? []}
            isLoading={employeesQuery.isLoading}
            errorMessage={employeesQuery.error instanceof Error ? employeesQuery.error.message : null}
            busyEmployeeId={emergencyAssignMutation.variables ?? null}
            isAssigning={emergencyAssignMutation.isPending}
            onAssign={(employeeId) => emergencyAssignMutation.mutate(employeeId)}
            mutationError={emergencyAssignMutation.error instanceof Error ? emergencyAssignMutation.error.message : null}
          />
        ) : null}

        <OperationalChatCard
          sourceType="emergency"
          recordId={recordId}
          currentUserId={currentUserId}
          locale={companyConfig.locale}
          timezone={companyConfig.timezone}
          photoPolicy={companyConfig.photoPolicy}
          allowInternalMessages
          placeholder="Escribe al tecnico o al cliente"
        />
      </ScrollView>
    );
  }

  if (requestQuery.isLoading) {
    return <LoadingScreen label="Cargando detalle..." />;
  }

  if (requestQuery.error || !requestQuery.data) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <SectionCard
          title="No se pudo cargar el item"
          subtitle={requestQuery.error instanceof Error ? requestQuery.error.message : 'Intenta de nuevo.'}
        />
      </ScrollView>
    );
  }

  const request = requestQuery.data;
  const companyConfig = bootstrap.companyConfig;
  const currentUserId = bootstrap.user.uid;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={requestQuery.isRefetching} onRefresh={() => void requestQuery.refetch()} />}
    >
      <SectionCard title={request.address || 'Solicitud'} subtitle={request.description || 'Sin descripcion'}>
        <Text style={styles.eyebrow}>{formatQueueSourceType(sourceType)}</Text>
        <Text style={styles.status}>{formatRequestStatus(request.status)}</Text>
      </SectionCard>

      <SectionCard title="Resumen">
        <KeyValueList
          items={[
            { label: 'Categoria', value: request.category || 'General' },
            { label: 'Cliente', value: request.clientNickname || request.clientEmail || 'Sin dato' },
            { label: 'Tecnico', value: request.employeeName || request.employeeEmail || 'Sin asignar' },
            { label: 'Creado', value: formatDateTime(request.createdAt, companyConfig.locale, companyConfig.timezone) },
            { label: 'Monto final', value: formatCurrency(request.finalAmount, companyConfig.currency, companyConfig.locale) },
          ]}
        />
      </SectionCard>

      <SectionCard title="Acciones">
        {request.paymentProofUrl ? (
          <AppButton tone="secondary" onPress={() => void Linking.openURL(request.paymentProofUrl ?? '')}>
            Ver comprobante
          </AppButton>
        ) : null}
        {request.assignedEmployeeId && request.status === 'ASIGNADO' ? (
          <AppButton
            tone="danger"
            loading={requestUnassignMutation.isPending}
            onPress={() => requestUnassignMutation.mutate()}
          >
            Liberar solicitud
          </AppButton>
        ) : null}
        {request.status === 'PAGO_PENDIENTE_REVISION' ? (
          <Link
            href={{
              pathname: '/(boss)/payments/[id]',
              params: { id: recordId, sourceType: 'request' },
            }}
            style={styles.link}
          >
            Ir a revision de pago
          </Link>
        ) : (
          <Text style={styles.muted}>Puedes asignar tecnico abajo o abrir revision si ya hay comprobante.</Text>
        )}
      </SectionCard>

      {!request.assignedEmployeeId && request.status === 'EN_ESPERA' ? (
        <AssignEmployeeSection
          employees={employeesQuery.data ?? []}
          isLoading={employeesQuery.isLoading}
          errorMessage={employeesQuery.error instanceof Error ? employeesQuery.error.message : null}
          busyEmployeeId={requestAssignMutation.variables ?? null}
          isAssigning={requestAssignMutation.isPending}
          onAssign={(employeeId) => requestAssignMutation.mutate(employeeId)}
          mutationError={requestAssignMutation.error instanceof Error ? requestAssignMutation.error.message : null}
        />
      ) : null}

      <OperationalChatCard
        sourceType="request"
        recordId={recordId}
        currentUserId={currentUserId}
        locale={companyConfig.locale}
        timezone={companyConfig.timezone}
        photoPolicy={companyConfig.photoPolicy}
        allowInternalMessages
        placeholder="Escribe al tecnico o al cliente"
      />
      {requestUnassignMutation.error instanceof Error ? (
        <Text style={styles.error}>{requestUnassignMutation.error.message}</Text>
      ) : null}
    </ScrollView>
  );
}

function AssignEmployeeSection(props: {
  employees: EmployeeDirectoryItem[];
  isLoading: boolean;
  errorMessage: string | null;
  mutationError: string | null;
  isAssigning: boolean;
  busyEmployeeId: string | null;
  onAssign: (employeeId: string) => void;
}) {
  const { employees, isLoading, errorMessage, mutationError, isAssigning, busyEmployeeId, onAssign } = props;

  return (
    <SectionCard title="Asignar tecnico" subtitle="Asignacion manual inicial desde boss.">
      {isLoading ? <Text style={styles.muted}>Cargando tecnicos...</Text> : null}
      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
      {mutationError ? <Text style={styles.error}>{mutationError}</Text> : null}
      {employees.length ? (
        <View style={styles.assignmentStack}>
          {employees.map((employee) => (
            <View key={employee.uid || employee.id} style={styles.assignmentRow}>
              <PressableCard
                title={employee.name || employee.email || 'Tecnico'}
                subtitle={employee.email || employee.phone || 'Sin contacto'}
                meta={employee.whatsappNumber || undefined}
              />
              <AppButton
                loading={isAssigning && busyEmployeeId === employee.uid}
                disabled={isAssigning}
                onPress={() => onAssign(employee.uid)}
              >
                Asignar
              </AppButton>
            </View>
          ))}
        </View>
      ) : null}
      {!isLoading && !errorMessage && !employees.length ? (
        <Text style={styles.muted}>No hay tecnicos disponibles para asignar.</Text>
      ) : null}
    </SectionCard>
  );
}

async function invalidateQueueQueries(
  queryClient: QueryClient,
  sourceType: 'request' | 'emergency',
  recordId: string,
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['boss-queue-detail', sourceType, recordId] }),
    queryClient.invalidateQueries({ queryKey: ['boss-requests'] }),
    queryClient.invalidateQueries({ queryKey: ['boss-emergency-calls'] }),
    queryClient.invalidateQueries({ queryKey: ['boss-review-queue'] }),
    queryClient.invalidateQueries({ queryKey: ['mobile-home'] }),
  ]);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F7FB',
  },
  content: {
    padding: 20,
    gap: 16,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0B5FFF',
    textTransform: 'uppercase',
  },
  status: {
    fontSize: 14,
    fontWeight: '700',
    color: '#10233F',
  },
  link: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0B5FFF',
  },
  muted: {
    fontSize: 14,
    color: '#6B778C',
  },
  error: {
    fontSize: 14,
    color: '#B42318',
  },
  assignmentStack: {
    gap: 12,
  },
  assignmentRow: {
    gap: 10,
  },
});
