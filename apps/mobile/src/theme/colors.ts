/** Single source of truth for every color in the app. */

export const colors = {
  // ── Brand / Primary ──
  primary: '#0B5FFF',
  primaryLight: '#E9F1FF',
  primaryPale: '#EEF4FF',
  primaryMuted: '#DCE8FF',
  primarySoft: '#8CC0FF',

  // ── Dark Navy ──
  navy: '#10233F',
  navyLabel: '#23324A',

  // ── Accent ──
  accent: '#7BB0FF',

  // ── Backgrounds ──
  pageBg: '#F4F7FB',
  cardBg: '#FFFFFF',
  inputBg: '#F8FAFD',

  // ── Text ──
  textPrimary: '#10233F',
  textSecondary: '#4A5970',
  textMuted: '#6B778C',
  textPlaceholder: '#8A94A6',
  textOnDark: '#FFFFFF',
  textSubtleOnDark: '#D1D8E2',

  // ── Borders ──
  border: '#D8E2F0',
  borderLight: '#D6DDE8',
  borderMedium: '#C7D5EA',

  // ── Semantic ──
  error: '#B42318',
  errorBg: '#FEF3F2',
  success: '#12B76A',
  successBg: '#ECFDF3',
  warning: '#F79009',
  warningBg: '#FFFAEB',

  // ── Status pairs (bg + text) ──
  statusWaiting: { bg: '#FFF4ED', text: '#B93815' },
  statusAssigned: { bg: '#E9F1FF', text: '#0B5FFF' },
  statusNegotiating: { bg: '#FFFAEB', text: '#B54708' },
  statusInProgress: { bg: '#ECFDF3', text: '#027A48' },
  statusAwaitingClient: { bg: '#FFF4ED', text: '#B93815' },
  statusAwaitingProof: { bg: '#FFFAEB', text: '#B54708' },
  statusPaymentReview: { bg: '#FEF3F2', text: '#B42318' },
  statusCompleted: { bg: '#ECFDF3', text: '#027A48' },
  statusPending: { bg: '#FFF4ED', text: '#B93815' },
  statusAccepted: { bg: '#E9F1FF', text: '#0B5FFF' },

  // ── Internal messages ──
  internalBg: '#FFF1E6',
  internalText: '#B54708',

  // ── Shadow ──
  shadow: '#10233F',
} as const;
