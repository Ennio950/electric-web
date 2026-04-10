import type { PropsWithChildren } from 'react';
import {
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { replaceAppRoute, type AppRouteHref } from '@/src/navigation/routes';
import { radii, spacing } from '@/src/theme';

const BACKGROUND_IMAGE = require('@/assets/images/bg-electric.webp');

type AuthPortalLayoutProps = PropsWithChildren<{
  backHref?: AppRouteHref;
  backLabel?: string;
  backAccentColor?: string;
}>;

export function AuthPortalLayout(props: AuthPortalLayoutProps) {
  const {
    backHref,
    backLabel = 'Volver al inicio',
    backAccentColor = '#f5c842',
    children,
  } = props;

  return (
    <ImageBackground source={BACKGROUND_IMAGE} style={styles.background} resizeMode="cover">
      <View pointerEvents="none" style={styles.overlay} />
      <View pointerEvents="none" style={[styles.glow, styles.leftGlow]} />
      <View pointerEvents="none" style={[styles.glow, styles.rightGlow]} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {backHref ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => replaceAppRoute(backHref)}
              style={({ pressed }) => [
                styles.backButton,
                { borderColor: `${backAccentColor}55` },
                pressed ? styles.backButtonPressed : null,
              ]}
            >
              <Text style={[styles.backArrow, { color: backAccentColor }]}>←</Text>
              <Text style={styles.backText}>{backLabel}</Text>
            </Pressable>
          ) : (
            <View style={styles.backSpacer} />
          )}

          <View style={styles.body}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: '#05070d',
  },
  flex: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(9, 8, 13, 0.78)',
  },
  glow: {
    position: 'absolute',
    width: 340,
    height: 340,
    borderRadius: 170,
    opacity: 0.18,
  },
  leftGlow: {
    left: -100,
    top: 80,
    backgroundColor: '#f59e0b',
  },
  rightGlow: {
    right: -120,
    bottom: 120,
    backgroundColor: '#7c3aed',
  },
  content: {
    flexGrow: 1,
    paddingTop: Platform.select({ ios: 62, android: 34, default: 32 }),
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  backSpacer: {
    height: 52,
  },
  backButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    backgroundColor: 'rgba(12, 10, 15, 0.7)',
  },
  backButtonPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.99 }],
  },
  backArrow: {
    fontSize: 16,
    fontWeight: '700',
  },
  backText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f8fafc',
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.lg,
  },
});
