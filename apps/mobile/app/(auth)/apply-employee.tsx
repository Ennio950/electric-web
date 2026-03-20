import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';

import { AppButton } from '@/src/components/AppButton';
import { auth } from '@/src/config/firebase';
import { submitEmployeeApplication } from '@/src/lib/api';
import { compressImageForUpload, uploadImageAsset } from '@/src/lib/imageUpload';
import { captureImageFromCamera, pickImageFromLibrary } from '@/src/lib/media';
import { appRoutes, replaceAppRoute } from '@/src/navigation/routes';
import { useSessionStore } from '@/src/stores/sessionStore';
import type { MobilePhotoPolicy } from '@/src/types/api';
import type { PickedImage } from '@/src/types/media';
import { colors, layout, radii, spacing } from '@/src/theme';

const FALLBACK_PHOTO_POLICY: MobilePhotoPolicy = {
  maxUploadBytes: 1024 * 1024,
  maxImageDimension: 1600,
  compressionTargetBytes: 1024 * 1024,
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
};

function getErrorCode(error: unknown) {
  if (!error || typeof error !== 'object' || !('code' in error)) {
    return null;
  }

  return typeof error.code === 'string' ? error.code : null;
}

function describeApplyError(error: unknown) {
  const code = getErrorCode(error);

  switch (code) {
    case 'auth/email-already-in-use':
      return 'Ese email ya existe. Usa la misma contraseña para continuar con la solicitud.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
      return 'El email ya existe, pero la contraseña no coincide.';
    case 'auth/invalid-email':
      return 'El email no es válido.';
    case 'auth/weak-password':
      return 'La contraseña debe tener al menos 6 caracteres.';
    case 'auth/network-request-failed':
      return 'No se pudo conectar con Firebase.';
    case 'auth/operation-not-allowed':
      return 'El registro por email/password está deshabilitado en Firebase.';
    default:
      return error instanceof Error ? error.message : 'No se pudo enviar la solicitud.';
  }
}

async function ensureApplicantUser(email: string, password: string) {
  try {
    const created = await createUserWithEmailAndPassword(auth, email, password);
    return created.user;
  } catch (error) {
    if (getErrorCode(error) !== 'auth/email-already-in-use') {
      throw error;
    }

    const existing = await signInWithEmailAndPassword(auth, email, password);
    return existing.user;
  }
}

export default function ApplyEmployeeScreen() {
  const bootstrap = useSessionStore((state) => state.bootstrap);
  const authUser = useSessionStore((state) => state.authUser);
  const setNotice = useSessionStore((state) => state.setNotice);
  const setAuthFlow = useSessionStore((state) => state.setAuthFlow);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState(auth.currentUser?.email ?? '');
  const [password, setPassword] = useState('');
  const [selfie, setSelfie] = useState<PickedImage | null>(null);
  const [isPickingSelfie, setIsPickingSelfie] = useState(false);

  useEffect(() => {
    setAuthFlow('employee-application');
    setNotice(null);

    return () => {
      setAuthFlow('idle');
    };
  }, [setAuthFlow, setNotice]);

  useEffect(() => {
    if (!name.trim() && bootstrap?.user.displayName) {
      setName(bootstrap.user.displayName);
    }

    if (!email.trim() && (bootstrap?.user.email || authUser?.email)) {
      setEmail(bootstrap?.user.email || authUser?.email || '');
    }
  }, [authUser?.email, bootstrap?.user.displayName, bootstrap?.user.email, email, name]);

  async function handlePickSelfie(source: 'library' | 'camera') {
    if (isPickingSelfie || submitMutation.isPending) return;

    setIsPickingSelfie(true);
    setNotice(null);

    try {
      const picked = source === 'camera'
        ? await captureImageFromCamera()
        : await pickImageFromLibrary();

      if (picked) {
        setSelfie(picked);
      }
    } finally {
      setIsPickingSelfie(false);
    }
  }

  async function handleCancel() {
    setNotice(null);

    if (auth.currentUser && !bootstrap) {
      await signOut(auth).catch(() => undefined);
    }

    setAuthFlow('idle');
    replaceAppRoute(appRoutes.authLogin);
  }

  const submitMutation = useMutation({
    mutationFn: async () => {
      const cleanName = name.trim();
      const cleanAddress = address.trim();
      const cleanPhone = phone.trim();
      const cleanEmail = (auth.currentUser?.email || email).trim().toLowerCase();
      const cleanPassword = password.trim();

      if (!cleanName) {
        throw new Error('Escribe tu nombre.');
      }

      if (!cleanAddress) {
        throw new Error('La dirección es obligatoria.');
      }

      if (!cleanPhone) {
        throw new Error('El teléfono es obligatorio.');
      }

      if (!selfie) {
        throw new Error('Toma o elige una selfie antes de enviar.');
      }

      let user = auth.currentUser;
      if (!user) {
        if (!cleanEmail) {
          throw new Error('Escribe tu email.');
        }

        if (!cleanPassword) {
          throw new Error('Escribe tu contraseña.');
        }

        user = await ensureApplicantUser(cleanEmail, cleanPassword);
      }

      const idTokenResult = await user.getIdTokenResult(true);
      const currentRole = typeof idTokenResult.claims.role === 'string' ? idTokenResult.claims.role.trim() : '';

      if (currentRole === 'employee') {
        throw new Error('Tu cuenta ya fue aprobada como employee. Usa el acceso normal.');
      }

      if (currentRole === 'boss') {
        throw new Error('Esta cuenta ya tiene acceso boss. Usa el acceso normal.');
      }

      const photoPolicy = bootstrap?.companyConfig.photoPolicy ?? FALLBACK_PHOTO_POLICY;
      const compressedSelfie = await compressImageForUpload(selfie, photoPolicy);
      const uploadedSelfie = await uploadImageAsset({
        token: idTokenResult.token,
        asset: compressedSelfie,
      });

      await updateProfile(user, {
        displayName: cleanName,
        photoURL: uploadedSelfie.url,
      }).catch(() => undefined);

      return submitEmployeeApplication(idTokenResult.token, {
        name: cleanName,
        displayName: cleanName,
        phone: cleanPhone,
        address: cleanAddress,
        photoUrl: uploadedSelfie.url,
      });
    },
    onSuccess: async () => {
      await signOut(auth).catch(() => undefined);
      setNotice('Solicitud enviada. El boss debe aprobar tu acceso antes de entrar como employee.');
      setAuthFlow('idle');
      replaceAppRoute(appRoutes.authLogin);
    },
  });

  const hasActiveAccount = Boolean(auth.currentUser);
  const canSubmit = Boolean(
    name.trim()
    && address.trim()
    && phone.trim()
    && selfie
    && (hasActiveAccount || (email.trim() && password.trim())),
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.safeArea}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Employee Application</Text>
          <Text style={styles.title}>Solicitud nativa para técnicos</Text>
          <Text style={styles.subtitle}>
            Crea o reutiliza tu cuenta Firebase, sube la selfie y deja la solicitud lista para revisión.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Nombre completo</Text>
          <TextInput
            placeholder="Tu nombre"
            placeholderTextColor={colors.textPlaceholder}
            style={styles.input}
            value={name}
            onChangeText={setName}
          />

          <Text style={styles.label}>Dirección</Text>
          <TextInput
            multiline
            numberOfLines={3}
            placeholder="Dirección actual"
            placeholderTextColor={colors.textPlaceholder}
            style={[styles.input, styles.textArea]}
            value={address}
            onChangeText={setAddress}
          />

          <Text style={styles.label}>Teléfono</Text>
          <TextInput
            keyboardType="phone-pad"
            placeholder="Número de contacto"
            placeholderTextColor={colors.textPlaceholder}
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
          />

          {hasActiveAccount ? (
            <View style={styles.accountBanner}>
              <Text style={styles.accountLabel}>Usando cuenta actual</Text>
              <Text style={styles.accountValue}>{auth.currentUser?.email || bootstrap?.user.email || 'Sin email'}</Text>
            </View>
          ) : (
            <>
              <Text style={styles.label}>Email</Text>
              <TextInput
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                placeholder="tecnico@electric.com"
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
            </>
          )}

          <Text style={styles.label}>Selfie</Text>
          <View style={styles.inlineActions}>
            <AppButton
              tone="secondary"
              loading={isPickingSelfie}
              disabled={submitMutation.isPending}
              onPress={() => void handlePickSelfie('library')}
            >
              Elegir de galería
            </AppButton>
            <AppButton
              tone="secondary"
              loading={isPickingSelfie}
              disabled={submitMutation.isPending}
              onPress={() => void handlePickSelfie('camera')}
            >
              Tomar selfie
            </AppButton>
          </View>

          {selfie ? (
            <View style={styles.previewCard}>
              <Image source={{ uri: selfie.uri }} style={styles.previewImage} />
              <Text style={styles.previewCaption}>Selfie lista para subir</Text>
            </View>
          ) : (
            <Text style={styles.helper}>
              Necesitamos una selfie para la revisión del boss. Puedes tomarla desde cámara o elegir una existente.
            </Text>
          )}

          {submitMutation.error instanceof Error ? (
            <View style={styles.noticeBanner}>
              <Text style={styles.notice}>{describeApplyError(submitMutation.error)}</Text>
            </View>
          ) : null}

          <View style={styles.footerActions}>
            <AppButton
              size="lg"
              loading={submitMutation.isPending}
              disabled={!canSubmit || isPickingSelfie}
              onPress={() => submitMutation.mutate()}
            >
              Enviar solicitud
            </AppButton>
            <AppButton
              size="lg"
              tone="secondary"
              disabled={submitMutation.isPending || isPickingSelfie}
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
  textArea: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  inlineActions: {
    gap: spacing.md,
  },
  previewCard: {
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.inputBg,
    padding: spacing.lg,
  },
  previewImage: {
    width: '100%',
    height: 240,
    borderRadius: radii.lg,
    backgroundColor: colors.primaryPale,
  },
  previewCaption: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  helper: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
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
  footerActions: {
    gap: spacing.md,
  },
});
