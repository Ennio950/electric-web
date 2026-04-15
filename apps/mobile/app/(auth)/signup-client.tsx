import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { createUserWithEmailAndPassword, signOut, updateProfile } from 'firebase/auth';

import { AppButton } from '@/src/components/AppButton';
import { auth } from '@/src/config/firebase';
import { ensureCurrentUserProfile, fetchBootstrap } from '@/src/lib/api';
import { appRoutes, replaceAppRoute } from '@/src/navigation/routes';
import { useSessionStore } from '@/src/stores/sessionStore';
import { colors, layout, radii, spacing } from '@/src/theme';

function describeSignupError(error: unknown) {
  const code =
    error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
      ? error.code
      : null;

  switch (code) {
    case 'auth/email-already-in-use':
      return 'Ese email ya está registrado. Usa iniciar sesión.';
    case 'auth/invalid-email':
      return 'El email no es válido.';
    case 'auth/weak-password':
      return 'La contraseña debe tener al menos 6 caracteres.';
    case 'auth/network-request-failed':
      return 'No se pudo conectar con Firebase.';
    case 'auth/operation-not-allowed':
      return 'El registro por email/password está deshabilitado en Firebase.';
    default:
      return error instanceof Error ? error.message : 'No se pudo crear la cuenta.';
  }
}

export default function SignupClientScreen() {
  const bootstrap = useSessionStore((state) => state.bootstrap);
  const setNotice = useSessionStore((state) => state.setNotice);
  const setAuthFlow = useSessionStore((state) => state.setAuthFlow);
  const finishBootstrap = useSessionStore((state) => state.finishBootstrap);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    setAuthFlow('client-signup');
    setNotice(null);

    return () => {
      setAuthFlow('idle');
    };
  }, [setAuthFlow, setNotice]);

  useEffect(() => {
    if (!email.trim() && auth.currentUser?.email) {
      setEmail(auth.currentUser.email);
    }

    if (!displayName.trim() && auth.currentUser?.displayName) {
      setDisplayName(auth.currentUser.displayName);
    }
  }, [displayName, email]);

  async function handleCancel() {
    setNotice(null);

    if (auth.currentUser && !bootstrap) {
      await signOut(auth).catch(() => undefined);
    }

    setAuthFlow('idle');
    replaceAppRoute(appRoutes.authClientLogin);
  }

  const signupMutation = useMutation({
    mutationFn: async () => {
      const cleanDisplayName = displayName.trim();
      const cleanEmail = (auth.currentUser?.email || email).trim().toLowerCase();
      const cleanPassword = password.trim();
      const cleanConfirmPassword = confirmPassword.trim();
      let user = auth.currentUser;

      if (!user) {
        if (!cleanEmail) {
          throw new Error('Escribe tu email.');
        }

        if (!cleanPassword) {
          throw new Error('Escribe tu contraseña.');
        }

        if (cleanPassword.length < 6) {
          throw new Error('La contraseña debe tener al menos 6 caracteres.');
        }

        if (cleanPassword !== cleanConfirmPassword) {
          throw new Error('Las contraseñas no coinciden.');
        }

        const created = await createUserWithEmailAndPassword(auth, cleanEmail, cleanPassword);
        user = created.user;
      }

      if (cleanDisplayName) {
        await updateProfile(user, { displayName: cleanDisplayName }).catch(() => undefined);
      }

      const token = await user.getIdToken();
      await ensureCurrentUserProfile(token, {
        displayName: cleanDisplayName || null,
      });

      const refreshedToken = await user.getIdToken(true);
      const nextBootstrap = await fetchBootstrap(refreshedToken);
      finishBootstrap(user, nextBootstrap);
      setAuthFlow('idle');
    },
    onSuccess: () => {
      setNotice(null);
      replaceAppRoute(appRoutes.clientHome);
    },
  });

  const hasActiveAccount = Boolean(auth.currentUser);
  const canSubmit = Boolean(
    hasActiveAccount
      ? email.trim() || auth.currentUser?.email
      : email.trim() && password.trim() && confirmPassword.trim(),
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.safeArea}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Client Signup</Text>
          <Text style={styles.title}>Crear cuenta cliente</Text>
          <Text style={styles.subtitle}>
            Alta nativa con Firebase y sincronización automática del rol `client` en el backend.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Nombre para mostrar</Text>
          <TextInput
            placeholder="Opcional"
            placeholderTextColor={colors.textPlaceholder}
            style={styles.input}
            value={displayName}
            onChangeText={setDisplayName}
          />

          {hasActiveAccount ? (
            <View style={styles.accountBanner}>
              <Text style={styles.accountLabel}>Usando cuenta actual</Text>
              <Text style={styles.accountValue}>{auth.currentUser?.email || 'Sin email'}</Text>
            </View>
          ) : (
            <>
              <Text style={styles.label}>Email</Text>
              <TextInput
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                placeholder="cliente@electric.com"
                placeholderTextColor={colors.textPlaceholder}
                style={styles.input}
                value={email}
                onChangeText={setEmail}
              />

              <Text style={styles.label}>Password</Text>
              <TextInput
                autoCapitalize="none"
                autoComplete="password"
                secureTextEntry
                placeholder="Minimo 6 caracteres"
                placeholderTextColor={colors.textPlaceholder}
                style={styles.input}
                value={password}
                onChangeText={setPassword}
              />

              <Text style={styles.label}>Confirmar password</Text>
              <TextInput
                autoCapitalize="none"
                secureTextEntry
                placeholder="Repite la password"
                placeholderTextColor={colors.textPlaceholder}
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
            </>
          )}

          {signupMutation.error instanceof Error ? (
            <View style={styles.noticeBanner}>
              <Text style={styles.notice}>{describeSignupError(signupMutation.error)}</Text>
            </View>
          ) : null}

          <View style={styles.actions}>
            <AppButton
              size="lg"
              loading={signupMutation.isPending}
              disabled={!canSubmit}
              onPress={() => signupMutation.mutate()}
            >
              Crear cuenta
            </AppButton>
            <AppButton
              size="lg"
              tone="secondary"
              disabled={signupMutation.isPending}
              onPress={() => void handleCancel()}
            >
              Volver al login
            </AppButton>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.pageBg,
  },
  content: {
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.xxxl,
    gap: spacing.xxl,
  },
  hero: {
    gap: spacing.sm,
  },
  eyebrow: {
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
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  card: {
    borderRadius: radii.xxxl,
    backgroundColor: colors.cardBg,
    padding: layout.containerPadding,
    gap: spacing.lg,
    shadowColor: colors.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.navyLabel,
  },
  input: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.inputBg,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    color: colors.navy,
  },
  noticeBanner: {
    borderRadius: radii.md,
    backgroundColor: colors.errorBg,
    paddingHorizontal: 14,
    paddingVertical: spacing.md,
  },
  notice: {
    fontSize: 14,
    color: colors.error,
  },
  accountBanner: {
    borderRadius: radii.lg,
    backgroundColor: colors.primaryPale,
    paddingHorizontal: 14,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  accountLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
  },
  accountValue: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.navy,
  },
  actions: {
    gap: spacing.md,
  },
});
