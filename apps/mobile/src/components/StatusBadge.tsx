import { StyleSheet, Text, View } from 'react-native';

import { formatEmergencyStatus, formatRequestStatus } from '@/src/lib/formatters';
import { colors, radii } from '@/src/theme';

type StatusBadgeProps = {
  status: string;
  type: 'request' | 'emergency';
};

type StatusColor = { bg: string; text: string };

const REQUEST_COLORS: Record<string, StatusColor> = {
  EN_ESPERA: colors.statusWaiting,
  ASIGNADO: colors.statusAssigned,
  CANCELADO: colors.statusCancelled,
  NEGOCIANDO: colors.statusNegotiating,
  EN_PROCESO: colors.statusInProgress,
  ESPERANDO_CIERRE_CLIENTE: colors.statusAwaitingClient,
  ESPERANDO_COMPROBANTE_PAGO: colors.statusAwaitingProof,
  PAGO_PENDIENTE_REVISION: colors.statusPaymentReview,
  COMPLETADO: colors.statusCompleted,
};

const EMERGENCY_COLORS: Record<string, StatusColor> = {
  pending: colors.statusPending,
  accepted: colors.statusAccepted,
  awaiting_client_close: colors.statusAwaitingClient,
  awaiting_payment_proof: colors.statusAwaitingProof,
  payment_pending_review: colors.statusPaymentReview,
  completed: colors.statusCompleted,
};

const FALLBACK: StatusColor = { bg: colors.primaryLight, text: colors.primary };

export function StatusBadge({ status, type }: StatusBadgeProps) {
  const colorMap = type === 'request' ? REQUEST_COLORS : EMERGENCY_COLORS;
  const pair = colorMap[status] ?? FALLBACK;
  const label = type === 'request' ? formatRequestStatus(status) : formatEmergencyStatus(status);

  return (
    <View style={[styles.pill, { backgroundColor: pair.bg }]}>
      <Text style={[styles.label, { color: pair.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
});
