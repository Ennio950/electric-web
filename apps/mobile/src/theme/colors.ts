/** Single source of truth for every color in the app — dark theme. */

export const colors = {
  // ── Brand / Primary ──
  primary: '#38bdf8',
  primaryLight: 'rgba(56,189,248,0.15)',
  primaryPale: 'rgba(56,189,248,0.10)',
  primaryMuted: 'rgba(56,189,248,0.20)',
  primarySoft: '#7dd3fc',

  // ── Dark Navy ──
  navy: '#e5f4ff',
  navyLabel: '#9bb2c9',

  // ── Accent ──
  accent: '#f5c842',

  // ── Backgrounds ──
  pageBg: '#050816',
  cardBg: 'rgba(8,15,34,0.92)',
  inputBg: 'rgba(255,255,255,0.06)',

  // ── Text ──
  textPrimary: '#e5f4ff',
  textSecondary: '#9bb2c9',
  textMuted: '#6b8ca8',
  textPlaceholder: '#4a6580',
  textOnDark: '#FFFFFF',
  textSubtleOnDark: '#9bb2c9',

  // ── Borders ──
  border: 'rgba(148,163,184,0.2)',
  borderLight: 'rgba(148,163,184,0.15)',
  borderMedium: 'rgba(148,163,184,0.25)',

  // ── Semantic ──
  error: '#fca5a5',
  errorBg: 'rgba(239,68,68,0.15)',
  success: '#6ee7b7',
  successBg: 'rgba(16,185,129,0.15)',
  warning: '#fcd34d',
  warningBg: 'rgba(245,158,11,0.15)',

  // ── Status pairs (bg + text) ──
  statusWaiting: { bg: 'rgba(245,158,11,0.15)', text: '#fcd34d' },
  statusAssigned: { bg: 'rgba(56,189,248,0.15)', text: '#38bdf8' },
  statusCancelled: { bg: 'rgba(239,68,68,0.15)', text: '#fca5a5' },
  statusNegotiating: { bg: 'rgba(245,158,11,0.15)', text: '#fbbf24' },
  statusInProgress: { bg: 'rgba(16,185,129,0.15)', text: '#6ee7b7' },
  statusAwaitingClient: { bg: 'rgba(245,158,11,0.15)', text: '#fcd34d' },
  statusAwaitingProof: { bg: 'rgba(245,158,11,0.15)', text: '#fbbf24' },
  statusPaymentReview: { bg: 'rgba(239,68,68,0.15)', text: '#fca5a5' },
  statusCompleted: { bg: 'rgba(16,185,129,0.15)', text: '#6ee7b7' },
  statusPending: { bg: 'rgba(245,158,11,0.15)', text: '#fcd34d' },
  statusAccepted: { bg: 'rgba(56,189,248,0.15)', text: '#38bdf8' },

  // ── Internal messages ──
  internalBg: 'rgba(245,158,11,0.12)',
  internalText: '#fbbf24',

  // ── Shadow ──
  shadow: '#000000',
} as const;
