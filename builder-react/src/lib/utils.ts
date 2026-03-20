import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function safeJsonParse<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function formatMoney(value: number, currency: string) {
  const safe = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat('es-GT', {
    style: 'currency',
    currency: currency || 'GTQ',
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  }).format(safe);
}

export function formatNumber(value: number, digits = 2) {
  const safe = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat('es-GT', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(safe);
}

export function uid(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

