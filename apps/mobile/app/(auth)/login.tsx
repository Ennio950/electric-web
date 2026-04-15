import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { signInWithEmailAndPassword } from 'firebase/auth';

import { AppButton } from '@/src/components/AppButton';
import { auth } from '@/src/config/firebase';
import { getApiBaseUrl } from '@/src/config/mobileEnv';
import { appRoutes, pushAppRoute } from '@/src/navigation/routes';
import { useSessionSnapshot, useSessionStore } from '@/src/stores/sessionStore';
import { colors, layout, radii, spacing } from '@/src/theme';

export default function LoginScreen() {
  const session = useSessionSnapshot();
  const setNotice = useSessionStore((state) => state.setNotice);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    if (isSubmitting) return;

    const cleanEmail = email.trim();
    if (!cleanEmail || !password.trim()) {
      setNotice('Completa email y password.');
      return;
    }

    setIsSubmitting(true);
    setNotice(null);

    try {
      await signInWithEmailAndPassword(auth, cleanEmail, password);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo iniciar sesion.';
      setNotice(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.safeArea}
    >
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Electric Staff</Text>
        <Text style={styles.title}>Acceso nativo para client, employee y boss</Text>
        <Text style={styles.subtitle}>
          Login con Firebase y bootstrap tipado contra el backend.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          placeholder="boss@electric.com"
          placeholderTextColor={colors.textPlaceholder}
          style={styles.input}
          value={email}
          onChangeText={setEmail}
        />

        <Text style={styles.label}>Password</Text>
        <View style={styles.passwordContainer}>
          <TextInput
            autoCapitalize="none"
            placeholder="Tu password"
            placeholderTextColor={colors.textPlaceholder}
            secureTextEntry={!showPassword}
            style={styles.passwordInput}
            value={password}
            onChangeText={setPassword}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            onPress={() => setShowPassword((prev) => !prev)}
            style={styles.passwordToggle}
          >
            <Text style={styles.passwordToggleLabel}>{showPassword ? 'Ocultar' : 'Mostrar'}</Text>
          </Pressable>
        </View>

        {session.notice ? (
          <View style={styles.noticeBanner}>
            <Text style={styles.notice}>{session.notice}</Text>
          </View>
        ) : null}

        <View style={styles.actions}>
          <AppButton size="lg" loading={isSubmitting} onPress={handleSubmit}>
            Entrar
          </AppButton>

          <AppButton
            size="lg"
            tone="secondary"
            disabled={isSubmitting}
            onPress={() => pushAppRoute(appRoutes.authSignupClient)}
          >
            Crear cuenta cliente
          </AppButton>

          <AppButton
            size="lg"
            tone="secondary"
            disabled={isSubmitting}
            onPress={() => pushAppRoute(appRoutes.authMagicClient)}
          >
            Entrar con código
          </AppButton>

          <AppButton
            size="lg"
            tone="secondary"
            disabled={isSubmitting}
            onPress={() => pushAppRoute(appRoutes.authApplyEmployee)}
          >
            Solicitar acceso como employee
          </AppButton>
        </View>

        {__DEV__ ? <Text style={styles.footnote}>API base: {getApiBaseUrl()}</Text> : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
    backgroundColor: colors.pageBg,
  },
  hero: {
    marginBottom: spacing.xxl,
  },
  eyebrow: {
    marginBottom: spacing.sm,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: colors.primary,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.navy,
  },
  subtitle: {
    marginTop: spacing.sm,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  card: {
    borderRadius: radii.xxxl,
    backgroundColor: colors.cardBg,
    padding: layout.containerPadding,
    shadowColor: colors.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  label: {
    marginBottom: spacing.sm,
    fontSize: 13,
    fontWeight: '700',
    color: colors.navyLabel,
  },
  input: {
    marginBottom: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.inputBg,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    color: colors.navy,
  },
  passwordContainer: {
    marginBottom: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.inputBg,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    color: colors.navy,
  },
  passwordToggle: {
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  passwordToggleLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  noticeBanner: {
    marginBottom: spacing.lg,
    borderRadius: radii.md,
    backgroundColor: colors.errorBg,
    paddingHorizontal: 14,
    paddingVertical: spacing.md,
  },
  notice: {
    fontSize: 14,
    color: colors.error,
  },
  actions: {
    gap: spacing.md,
  },
  footnote: {
    marginTop: spacing.lg,
    fontSize: 12,
    color: colors.textPlaceholder,
  },
});
