import type { ReactNode } from 'react';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { signInWithEmailAndPassword } from 'firebase/auth';

import { auth } from '@/src/config/firebase';
import { type AppRouteHref } from '@/src/navigation/routes';
import { useSessionSnapshot, useSessionStore } from '@/src/stores/sessionStore';
import { colors, radii, spacing } from '@/src/theme';

import { AuthPortalLayout } from './AuthPortalLayout';

const LOGO = require('@/assets/images/logo.webp');

type RoleLoginScreenProps = {
  header: ReactNode;
  primaryLabel: string;
  accentColor: string;
  primaryTextColor?: string;
  cardBorderColor: string;
  backHref: AppRouteHref;
  backAccentColor?: string;
  emailLabel?: string;
  emailPlaceholder: string;
  initialEmail?: string;
  passwordLabel?: string;
  passwordPlaceholder?: string;
  initialPassword?: string;
  secondaryContent?: ReactNode;
  footerContent?: ReactNode;
  logoWidth?: number;
  logoHeight?: number;
};

export function RoleLoginScreen(props: RoleLoginScreenProps) {
  const {
    header,
    primaryLabel,
    accentColor,
    primaryTextColor = '#ffffff',
    cardBorderColor,
    backHref,
    backAccentColor,
    emailLabel = 'Correo electronico',
    emailPlaceholder,
    initialEmail,
    passwordLabel = 'Contrasena',
    passwordPlaceholder = 'Tu contrasena',
    initialPassword,
    secondaryContent,
    footerContent,
    logoWidth = 180,
    logoHeight = 86,
  } = props;
  const session = useSessionSnapshot();
  const setNotice = useSessionStore((state) => state.setNotice);
  const [email, setEmail] = useState(initialEmail ?? '');
  const [password, setPassword] = useState(initialPassword ?? '');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    if (isSubmitting) {
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      setNotice('Completa email y contrasena.');
      return;
    }

    setIsSubmitting(true);
    setNotice(null);

    try {
      console.log('[auth/login] submit', {
        email: cleanEmail,
        passwordLength: cleanPassword.length,
        projectId: auth.app.options.projectId ?? null,
        apiKeySuffix: auth.app.options.apiKey?.slice(-6) ?? null,
      });
      await signInWithEmailAndPassword(auth, cleanEmail, cleanPassword);
    } catch (error) {
      const firebaseCode =
        typeof error === 'object' && error && 'code' in error && typeof error.code === 'string'
          ? error.code
          : null;
      const firebaseMessage = error instanceof Error ? error.message : 'No se pudo iniciar sesion.';
      console.error('[auth/login] failed', {
        email: cleanEmail,
        passwordLength: cleanPassword.length,
        code: firebaseCode,
        message: firebaseMessage,
      });
      const message = firebaseCode ? `${firebaseMessage} [${firebaseCode}]` : firebaseMessage;
      setNotice(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthPortalLayout backHref={backHref} backAccentColor={backAccentColor ?? accentColor}>
      <View style={[styles.card, { borderColor: cardBorderColor }]}>
        <Image
          source={LOGO}
          resizeMode="contain"
          style={[styles.logo, { width: logoWidth, height: logoHeight }]}
        />

        <View style={styles.headerBlock}>{header}</View>

        <View style={styles.formBlock}>
          <View style={styles.fieldBlock}>
            <Text style={styles.label}>{emailLabel}</Text>
            <TextInput
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              placeholder={emailPlaceholder}
              placeholderTextColor="#4f5566"
              style={styles.input}
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.label}>{passwordLabel}</Text>
            <View style={styles.passwordWrap}>
              <TextInput
                autoCapitalize="none"
                autoComplete="password"
                placeholder={passwordPlaceholder}
                placeholderTextColor="#4f5566"
                secureTextEntry={!showPassword}
                style={styles.passwordInput}
                value={password}
                onChangeText={setPassword}
              />
              <Pressable
                accessibilityRole="button"
                onPress={() => setShowPassword((value) => !value)}
                style={({ pressed }) => [
                  styles.passwordToggle,
                  pressed ? styles.passwordTogglePressed : null,
                ]}
              >
                <Text style={styles.passwordToggleText}>{showPassword ? 'Ocultar' : 'Ver'}</Text>
              </Pressable>
            </View>
          </View>

          {session.notice ? (
            <View style={styles.noticeBanner}>
              <Text style={styles.noticeText}>{session.notice}</Text>
            </View>
          ) : null}

          <Pressable
            accessibilityRole="button"
            disabled={isSubmitting}
            onPress={() => void handleSubmit()}
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: accentColor },
              isSubmitting ? styles.buttonDisabled : null,
              pressed && !isSubmitting ? styles.primaryButtonPressed : null,
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator color={primaryTextColor} />
            ) : (
              <Text style={[styles.primaryButtonText, { color: primaryTextColor }]}>
                {primaryLabel}
              </Text>
            )}
          </Pressable>

          {secondaryContent}
          {footerContent}
        </View>
      </View>
    </AuthPortalLayout>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: 520,
    borderRadius: 28,
    borderWidth: 1,
    backgroundColor: 'rgba(17, 12, 14, 0.9)',
    paddingHorizontal: 28,
    paddingTop: 34,
    paddingBottom: 28,
    shadowColor: '#000000',
    shadowOpacity: 0.22,
    shadowOffset: { width: 0, height: 18 },
    shadowRadius: 32,
    elevation: 12,
  },
  logo: {
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  headerBlock: {
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xxl,
  },
  formBlock: {
    gap: spacing.lg,
  },
  fieldBlock: {
    gap: spacing.sm,
  },
  label: {
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: '#a1a1aa',
  },
  input: {
    minHeight: 54,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(11, 9, 10, 0.8)',
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.textOnDark,
  },
  passwordWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(11, 9, 10, 0.8)',
  },
  passwordInput: {
    flex: 1,
    minHeight: 54,
    paddingLeft: 16,
    paddingRight: 8,
    fontSize: 16,
    color: colors.textOnDark,
  },
  passwordToggle: {
    marginRight: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  passwordTogglePressed: {
    opacity: 0.85,
  },
  passwordToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#d4d4d8',
  },
  noticeBanner: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.35)',
    backgroundColor: 'rgba(127,29,29,0.25)',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  noticeText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#fecaca',
  },
  primaryButton: {
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    paddingHorizontal: 20,
    shadowColor: '#000000',
    shadowOpacity: 0.16,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 6,
  },
  primaryButtonPressed: {
    transform: [{ scale: 0.99 }],
    opacity: 0.94,
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
