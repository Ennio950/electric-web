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
import { signInWithCustomToken, signOut } from 'firebase/auth';

import { AppButton } from '@/src/components/AppButton';
import { auth } from '@/src/config/firebase';
import { fetchBootstrap, startMagicClientAuth, verifyMagicClientAuth } from '@/src/lib/api';
import { appRoutes, replaceAppRoute } from '@/src/navigation/routes';
import { useSessionStore } from '@/src/stores/sessionStore';
import { colors, layout, radii, spacing } from '@/src/theme';

function describeMagicError(error: unknown) {
  return error instanceof Error ? error.message : 'No se pudo completar el acceso mágico.';
}

export default function MagicClientScreen() {
  const bootstrap = useSessionStore((state) => state.bootstrap);
  const setNotice = useSessionStore((state) => state.setNotice);
  const setAuthFlow = useSessionStore((state) => state.setAuthFlow);
  const finishBootstrap = useSessionStore((state) => state.finishBootstrap);
  const [email, setEmail] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [code, setCode] = useState('');

  useEffect(() => {
    setAuthFlow('client-magic');
    setNotice(null);

    return () => {
      setAuthFlow('idle');
    };
  }, [setAuthFlow, setNotice]);

  async function handleCancel() {
    setNotice(null);

    if (auth.currentUser && !bootstrap) {
      await signOut(auth).catch(() => undefined);
    }

    setAuthFlow('idle');
    replaceAppRoute(appRoutes.authLogin);
  }

  const startMutation = useMutation({
    mutationFn: async () => {
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail) {
        throw new Error('Escribe tu email.');
      }

      return startMagicClientAuth(cleanEmail);
    },
    onSuccess: (result) => {
      setChallengeId(result.challengeId);
      setNotice('Código enviado. En desarrollo, revisa el log del backend para ver el OTP.');
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async () => {
      const cleanEmail = email.trim().toLowerCase();
      const cleanChallengeId = challengeId.trim();
      const cleanCode = code.trim();

      if (!cleanEmail) {
        throw new Error('Escribe tu email.');
      }

      if (!cleanChallengeId) {
        throw new Error('Primero solicita el código.');
      }

      if (cleanCode.length !== 6) {
        throw new Error('El código debe tener 6 dígitos.');
      }

      const result = await verifyMagicClientAuth(cleanEmail, cleanChallengeId, cleanCode);
      const credential = await signInWithCustomToken(auth, result.customToken);
      const token = await credential.user.getIdToken(true);
      const nextBootstrap = await fetchBootstrap(token);
      finishBootstrap(credential.user, nextBootstrap);
      setAuthFlow('idle');
      return result;
    },
    onSuccess: () => {
      setNotice(null);
      replaceAppRoute(appRoutes.clientHome);
    },
  });

  const canRequestCode = Boolean(email.trim());
  const canVerify = Boolean(email.trim() && challengeId.trim() && code.trim().length === 6);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.safeArea}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Magic Login</Text>
          <Text style={styles.title}>Acceso cliente por código</Text>
          <Text style={styles.subtitle}>
            Pide el OTP por email y entra sin password usando el flujo mágico del backend.
          </Text>
        </View>

        <View style={styles.card}>
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

          <AppButton
            size="lg"
            tone="secondary"
            loading={startMutation.isPending}
            disabled={!canRequestCode || verifyMutation.isPending}
            onPress={() => startMutation.mutate()}
          >
            Enviar código
          </AppButton>

          <Text style={styles.label}>Challenge ID</Text>
          <TextInput
            autoCapitalize="none"
            placeholder="Se llena al pedir el código"
            placeholderTextColor={colors.textPlaceholder}
            style={styles.input}
            value={challengeId}
            onChangeText={setChallengeId}
          />

          <Text style={styles.label}>Código OTP</Text>
          <TextInput
            keyboardType="number-pad"
            maxLength={6}
            placeholder="123456"
            placeholderTextColor={colors.textPlaceholder}
            style={styles.input}
            value={code}
            onChangeText={setCode}
          />

          {startMutation.error instanceof Error ? (
            <View style={styles.noticeBanner}>
              <Text style={styles.notice}>{describeMagicError(startMutation.error)}</Text>
            </View>
          ) : null}
          {verifyMutation.error instanceof Error ? (
            <View style={styles.noticeBanner}>
              <Text style={styles.notice}>{describeMagicError(verifyMutation.error)}</Text>
            </View>
          ) : null}

          <View style={styles.actions}>
            <AppButton
              size="lg"
              loading={verifyMutation.isPending}
              disabled={!canVerify || startMutation.isPending}
              onPress={() => verifyMutation.mutate()}
            >
              Entrar con código
            </AppButton>
            <AppButton
              size="lg"
              tone="secondary"
              disabled={startMutation.isPending || verifyMutation.isPending}
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
  actions: {
    gap: spacing.md,
  },
});
