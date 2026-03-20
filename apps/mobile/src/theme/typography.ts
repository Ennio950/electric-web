import type { TextStyle } from 'react-native';

import { colors } from './colors';

/** Centralized text style presets. Spread into StyleSheet values. */
export const typography = {
  heroTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.textOnDark,
  } satisfies TextStyle,

  h1: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.navy,
  } satisfies TextStyle,

  h2: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.navy,
  } satisfies TextStyle,

  h3: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.navy,
  } satisfies TextStyle,

  eyebrow: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  } satisfies TextStyle,

  eyebrowSmall: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  } satisfies TextStyle,

  body: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
  } satisfies TextStyle,

  bodyStrong: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
    color: colors.navy,
  } satisfies TextStyle,

  caption: {
    fontSize: 13,
    color: colors.textMuted,
  } satisfies TextStyle,

  captionStrong: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  } satisfies TextStyle,

  meta: {
    fontSize: 12,
    color: colors.textMuted,
  } satisfies TextStyle,

  metaStrong: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  } satisfies TextStyle,

  label: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.navyLabel,
  } satisfies TextStyle,

  kvLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.textMuted,
  } satisfies TextStyle,

  statValue: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.navy,
  } satisfies TextStyle,

  button: {
    fontSize: 15,
    fontWeight: '700',
  } satisfies TextStyle,

  buttonSm: {
    fontSize: 13,
    fontWeight: '700',
  } satisfies TextStyle,

  buttonLg: {
    fontSize: 16,
    fontWeight: '700',
  } satisfies TextStyle,

  error: {
    fontSize: 14,
    color: colors.error,
  } satisfies TextStyle,

  muted: {
    fontSize: 14,
    color: colors.textMuted,
  } satisfies TextStyle,
} as const;
