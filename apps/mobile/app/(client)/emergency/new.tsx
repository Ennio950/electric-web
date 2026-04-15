import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/src/components/AppButton';
import { FilterChips } from '@/src/components/FilterChips';
import { FormInput } from '@/src/components/FormInput';
import { KeyboardSafeScrollView } from '@/src/components/KeyboardSafeScrollView';
import { LoadingScreen } from '@/src/components/LoadingScreen';
import { SectionCard } from '@/src/components/SectionCard';
import { createClientEmergencyCall, withCurrentToken } from '@/src/lib/api';
import { appRoutes, replaceAppRoute } from '@/src/navigation/routes';
import { useSessionStore } from '@/src/stores/sessionStore';
import { colors, spacing } from '@/src/theme';

const PRIORITY_OPTIONS = [
  { label: 'Urgente', value: 'urgent' },
  { label: 'Alta', value: 'high' },
  { label: 'Critica', value: 'critical' },
];

const MODE_OPTIONS = [
  { label: 'Emergencia', value: 'emergency' },
  { label: 'Programado', value: 'scheduled' },
];

export default function ClientEmergencyNewScreen() {
  const bootstrap = useSessionStore((state) => state.bootstrap);
  const queryClient = useQueryClient();
  const [clientName, setClientName] = useState(bootstrap?.user.displayName || '');
  const [phone, setPhone] = useState(bootstrap?.companyConfig.supportPhone || '');
  const [location, setLocation] = useState('');
  const [issue, setIssue] = useState('');
  const [priority, setPriority] = useState('urgent');
  const [dispatchMode, setDispatchMode] = useState<'emergency' | 'scheduled'>('emergency');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');

  const canSubmit = useMemo(() => {
    const hasBase = Boolean(clientName.trim() && phone.trim() && location.trim() && issue.trim());
    if (!hasBase) {
      return false;
    }

    if (dispatchMode !== 'scheduled') {
      return true;
    }

    return Boolean(scheduledDate.trim() && scheduledTime.trim());
  }, [clientName, dispatchMode, issue, location, phone, scheduledDate, scheduledTime]);

  const createMutation = useMutation({
    mutationFn: () => withCurrentToken((token) => createClientEmergencyCall(token, {
      clientName: clientName.trim(),
      phone: phone.trim(),
      location: location.trim(),
      issue: issue.trim(),
      priority,
      dispatchMode,
      scheduledDate: dispatchMode === 'scheduled' ? scheduledDate.trim() : undefined,
      scheduledTime: dispatchMode === 'scheduled' ? scheduledTime.trim() : undefined,
    })),
    onSuccess: async (call) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['client-emergency-calls'] }),
        queryClient.invalidateQueries({ queryKey: ['mobile-home'] }),
      ]);
      replaceAppRoute(appRoutes.clientEmergencyDetail(call.id));
    },
  });

  if (!bootstrap) {
    return <LoadingScreen label="Preparando emergencia..." />;
  }

  return (
    <KeyboardSafeScrollView style={styles.container} contentContainerStyle={styles.content}>
      <SectionCard
        title="Nueva emergencia"
        subtitle="Abre un servicio urgente o agenda uno programado desde el mismo flujo."
      >
        <Text style={styles.chipLabel}>Tipo</Text>
        <FilterChips value={dispatchMode} onChange={(value) => setDispatchMode(value as 'emergency' | 'scheduled')} options={MODE_OPTIONS} />

        <Text style={styles.chipLabel}>Prioridad</Text>
        <FilterChips value={priority} onChange={setPriority} options={PRIORITY_OPTIONS} />

        <FormInput
          label="Nombre de contacto"
          placeholder="Tu nombre"
          value={clientName}
          onChangeText={setClientName}
        />

        <FormInput
          label="Telefono"
          keyboardType="phone-pad"
          placeholder="Telefono de contacto"
          value={phone}
          onChangeText={setPhone}
        />

        <FormInput
          label="Ubicacion"
          placeholder="Direccion o punto de referencia"
          value={location}
          onChangeText={setLocation}
        />

        <FormInput
          label="Detalle"
          multiline
          numberOfLines={5}
          placeholder="Explica el problema"
          value={issue}
          onChangeText={setIssue}
        />

        {dispatchMode === 'scheduled' ? (
          <View style={styles.row}>
            <View style={styles.flexField}>
              <FormInput
                label="Fecha"
                placeholder="2026-03-11"
                value={scheduledDate}
                onChangeText={setScheduledDate}
              />
            </View>
            <View style={styles.flexField}>
              <FormInput
                label="Hora"
                placeholder="14:30"
                value={scheduledTime}
                onChangeText={setScheduledTime}
              />
            </View>
          </View>
        ) : null}

        <AppButton loading={createMutation.isPending} disabled={!canSubmit} onPress={() => createMutation.mutate()}>
          Crear emergencia
        </AppButton>

        {createMutation.error instanceof Error ? <Text style={styles.error}>{createMutation.error.message}</Text> : null}
      </SectionCard>
    </KeyboardSafeScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.pageBg,
  },
  content: {
    padding: spacing.xl,
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.navyLabel,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  flexField: {
    flex: 1,
  },
  error: {
    fontSize: 14,
    color: colors.error,
  },
});
