import type { EmergencyCallStatus, MarketplaceRequestStatus, ReviewQueueSourceType } from '@/src/types/api';

const REQUEST_STATUS_LABELS: Record<string, string> = {
  EN_ESPERA: 'En espera',
  ASIGNADO: 'Asignado',
  NEGOCIANDO: 'Negociando',
  EN_PROCESO: 'En proceso',
  ESPERANDO_CIERRE_CLIENTE: 'Esperando cierre del cliente',
  ESPERANDO_COMPROBANTE_PAGO: 'Esperando comprobante',
  PAGO_PENDIENTE_REVISION: 'Pago pendiente de revision',
  COMPLETADO: 'Completado',
};

const EMERGENCY_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  accepted: 'Aceptada',
  awaiting_client_close: 'Esperando cierre del cliente',
  awaiting_payment_proof: 'Esperando comprobante',
  payment_pending_review: 'Pago pendiente de revision',
  completed: 'Completada',
};

export function formatRequestStatus(status: MarketplaceRequestStatus | null | undefined) {
  if (!status) return 'Sin estado';
  return REQUEST_STATUS_LABELS[status] ?? sentenceCase(status);
}

export function formatEmergencyStatus(status: EmergencyCallStatus | null | undefined) {
  if (!status) return 'Sin estado';
  return EMERGENCY_STATUS_LABELS[status] ?? sentenceCase(status);
}

export function formatQueueSourceType(sourceType: ReviewQueueSourceType | null | undefined) {
  if (sourceType === 'emergency') return 'Emergencia';
  return 'Solicitud';
}

export function formatCurrency(value: number | null | undefined, currency: string, locale: string) {
  if (!Number.isFinite(value)) return 'Pendiente';

  return new Intl.NumberFormat(locale || 'es-GT', {
    style: 'currency',
    currency: currency || 'GTQ',
    maximumFractionDigits: 2,
  }).format(Number(value));
}

export function formatDateTime(value: string | null | undefined, locale: string, timezone: string) {
  if (!value) return 'Sin fecha';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin fecha';

  return new Intl.DateTimeFormat(locale || 'es-GT', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timezone || 'America/Guatemala',
  }).format(date);
}

function sentenceCase(value: string) {
  const normalized = value.replace(/_/g, ' ').trim().toLowerCase();
  if (!normalized) return 'Sin dato';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}
