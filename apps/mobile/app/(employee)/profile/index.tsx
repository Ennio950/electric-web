import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Linking, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '@/src/components/AppButton';
import { EmptyState } from '@/src/components/EmptyState';
import { KeyboardSafeScrollView } from '@/src/components/KeyboardSafeScrollView';
import { LoadingScreen } from '@/src/components/LoadingScreen';
import { PressableCard } from '@/src/components/PressableCard';
import { QueryErrorBanner } from '@/src/components/QueryErrorBanner';
import { SectionCard } from '@/src/components/SectionCard';
import {
  fetchEmployeePublicProfile,
  fetchMyEmployeePhotoChange,
  requestMyEmployeePhotoChange,
  submitMyEmployeePhotoChange,
  updateMyEmployeeProfile,
  withCurrentToken,
} from '@/src/lib/api';
import { formatDateTime } from '@/src/lib/formatters';
import { compressImageForUpload, uploadImageAsset } from '@/src/lib/imageUpload';
import { captureImageFromCamera, pickImageFromLibrary } from '@/src/lib/media';
import { useSessionStore } from '@/src/stores/sessionStore';
import { colors, layout, radii, spacing } from '@/src/theme';

export default function EmployeeProfileScreen() {
  const bootstrap = useSessionStore((state) => state.bootstrap);
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [age, setAge] = useState('');
  const [address, setAddress] = useState('');
  const [uploadedPhotoUrl, setUploadedPhotoUrl] = useState('');

  const publicProfileQuery = useQuery({
    queryKey: ['employee-public-profile', bootstrap?.user.uid],
    enabled: Boolean(bootstrap?.user.uid),
    queryFn: () => withCurrentToken((token) => fetchEmployeePublicProfile(token, bootstrap!.user.uid)),
  });

  const photoChangeQuery = useQuery({
    queryKey: ['employee-photo-change'],
    queryFn: () => withCurrentToken(fetchMyEmployeePhotoChange),
  });

  useEffect(() => {
    const profile = publicProfileQuery.data;
    if (!profile) {
      return;
    }

    setName(profile.name || '');
    setDisplayName(profile.displayName || '');
    setAge(profile.age != null ? String(profile.age) : '');
    setAddress(profile.address || '');
  }, [publicProfileQuery.data]);

  const saveProfileMutation = useMutation({
    mutationFn: async () => {
      const nextAge = age.trim() ? Number(age.trim()) : null;
      if (nextAge != null && (!Number.isFinite(nextAge) || nextAge < 0)) {
        throw new Error('Edad inválida.');
      }

      return withCurrentToken((token) => updateMyEmployeeProfile(token, {
        name: name.trim() || undefined,
        displayName: displayName.trim() || undefined,
        age: nextAge ?? undefined,
        address: address.trim() || undefined,
      }));
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['employee-public-profile', bootstrap?.user.uid] });
    },
  });

  const requestPhotoMutation = useMutation({
    mutationFn: () => withCurrentToken(requestMyEmployeePhotoChange),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['employee-photo-change'] });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (source: 'library' | 'camera') => {
      if (!bootstrap) {
        throw new Error('Bootstrap no disponible.');
      }

      const pickedImage = source === 'camera'
        ? await captureImageFromCamera()
        : await pickImageFromLibrary();

      if (!pickedImage) {
        return null;
      }

      const compressed = await compressImageForUpload(pickedImage, bootstrap.companyConfig.photoPolicy);
      return withCurrentToken(async (token) => {
        const uploaded = await uploadImageAsset({ token, asset: compressed });
        return uploaded.url;
      });
    },
    onSuccess: (url) => {
      if (url) {
        setUploadedPhotoUrl(url);
      }
    },
  });

  const submitPhotoMutation = useMutation({
    mutationFn: async () => {
      const photoUrl = uploadedPhotoUrl.trim();
      if (!photoUrl) {
        throw new Error('Primero sube la nueva foto.');
      }
      return withCurrentToken((token) => submitMyEmployeePhotoChange(token, photoUrl));
    },
    onSuccess: async () => {
      setUploadedPhotoUrl('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['employee-photo-change'] }),
        queryClient.invalidateQueries({ queryKey: ['employee-public-profile', bootstrap?.user.uid] }),
      ]);
    },
  });

  const isRefreshing = publicProfileQuery.isRefetching || photoChangeQuery.isRefetching;
  const photoChangeStatus = String(photoChangeQuery.data?.status || 'none').trim().toLowerCase();
  const ratingAverage = publicProfileQuery.data?.rating?.average ?? 0;
  const totalRatings = publicProfileQuery.data?.rating?.totalRatings ?? 0;
  const portfolio = publicProfileQuery.data?.portfolio ?? [];

  const errorMessage = useMemo(() => {
    const candidates = [
      publicProfileQuery.error,
      photoChangeQuery.error,
      saveProfileMutation.error,
      requestPhotoMutation.error,
      uploadMutation.error,
      submitPhotoMutation.error,
    ];
    const firstError = candidates.find((candidate) => candidate instanceof Error);
    return firstError instanceof Error ? firstError.message : null;
  }, [
    publicProfileQuery.error,
    photoChangeQuery.error,
    saveProfileMutation.error,
    requestPhotoMutation.error,
    uploadMutation.error,
    submitPhotoMutation.error,
  ]);

  if (!bootstrap) {
    return <LoadingScreen label="Cargando perfil..." />;
  }

  return (
    <KeyboardSafeScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => {
            void Promise.all([publicProfileQuery.refetch(), photoChangeQuery.refetch()]);
          }}
        />
      }
    >
      <SectionCard title="Perfil público" subtitle="Esto es lo que ve el cliente cuando revisa tu ficha técnica.">
        {publicProfileQuery.isLoading ? <LoadingScreen variant="skeleton" /> : null}
        <View style={styles.metricsRow}>
          <MetricCard label="Rating" value={ratingAverage.toFixed(1)} hint={`${totalRatings} reviews`} />
          <MetricCard label="Portfolio" value={String(portfolio.length)} hint="Fotos visibles" />
        </View>
        {publicProfileQuery.data?.photoUrl ? (
          <AppButton tone="secondary" onPress={() => void Linking.openURL(publicProfileQuery.data?.photoUrl ?? '')}>
            Ver foto pública
          </AppButton>
        ) : null}
      </SectionCard>

      <SectionCard title="Editar perfil" subtitle="Ajusta nombre, alias, edad y dirección sin salir de la app.">
        <Field label="Nombre" value={name} onChangeText={setName} />
        <Field label="Display name" value={displayName} onChangeText={setDisplayName} />
        <View style={styles.row}>
          <View style={styles.flexField}>
            <Field label="Edad" value={age} onChangeText={setAge} keyboardType="numeric" />
          </View>
          <View style={styles.flexField}>
            <Field label="Email" value={bootstrap.user.email || ''} onChangeText={() => undefined} editable={false} />
          </View>
        </View>
        <Field label="Dirección" value={address} onChangeText={setAddress} multiline />
        <AppButton loading={saveProfileMutation.isPending} onPress={() => saveProfileMutation.mutate()}>
          Guardar perfil
        </AppButton>
      </SectionCard>

      <SectionCard title="Cambio de foto" subtitle="El flujo sigue con aprobación del boss antes de subir una nueva selfie.">
        <Text style={styles.metaLine}>{bootstrap.user.email || 'Sin email'}</Text>
        <Text style={styles.status}>{`Estado actual: ${photoChangeStatus.toUpperCase()}`}</Text>
        {photoChangeStatus === 'none' || photoChangeStatus === 'rejected' || photoChangeStatus === 'completed' ? (
          <AppButton loading={requestPhotoMutation.isPending} onPress={() => requestPhotoMutation.mutate()}>
            Solicitar cambio de foto
          </AppButton>
        ) : null}
        {photoChangeQuery.data?.currentPhotoUrl ? (
          <AppButton tone="secondary" onPress={() => void Linking.openURL(photoChangeQuery.data?.currentPhotoUrl ?? '')}>
            Ver foto actual
          </AppButton>
        ) : null}
      </SectionCard>

      {photoChangeStatus === 'approved' ? (
        <SectionCard title="Subir selfie aprobada" subtitle="Cuando la solicitud está aprobada, sube la nueva foto desde cámara o galería.">
          <View style={styles.actions}>
            <AppButton tone="secondary" loading={uploadMutation.isPending} onPress={() => uploadMutation.mutate('library')}>
              Elegir de galería
            </AppButton>
            <AppButton tone="secondary" loading={uploadMutation.isPending} onPress={() => uploadMutation.mutate('camera')}>
              Tomar selfie
            </AppButton>
          </View>
          {uploadedPhotoUrl ? (
            <AppButton tone="secondary" onPress={() => void Linking.openURL(uploadedPhotoUrl)}>
              Ver foto cargada
            </AppButton>
          ) : null}
          <AppButton loading={submitPhotoMutation.isPending} disabled={!uploadedPhotoUrl.trim()} onPress={() => submitPhotoMutation.mutate()}>
            Enviar selfie aprobada
          </AppButton>
        </SectionCard>
      ) : null}

      <SectionCard title="Portfolio" subtitle="Tus últimas fotos públicas generadas por trabajos completados.">
        {portfolio.length ? (
          <View style={styles.stack}>
            {portfolio.slice().reverse().map((item, index) => (
              <PressableCard
                key={`${item.url}-${index}`}
                eyebrow={`Foto ${portfolio.length - index}`}
                title="Abrir imagen"
                subtitle={item.url}
                meta={formatDateTime(item.addedAt || null, bootstrap.companyConfig.locale, bootstrap.companyConfig.timezone)}
                onPress={() => void Linking.openURL(item.url)}
              />
            ))}
          </View>
        ) : (
          <EmptyState
            icon="🧰"
            title="Sin portfolio todavía"
            subtitle="Las fotos finales de trabajos cerrados se irán acumulando aquí."
          />
        )}
      </SectionCard>

      {photoChangeQuery.data?.newPhotoUrl ? (
        <SectionCard title="Última foto enviada">
          <AppButton tone="secondary" onPress={() => void Linking.openURL(photoChangeQuery.data?.newPhotoUrl ?? '')}>
            Ver foto enviada
          </AppButton>
        </SectionCard>
      ) : null}

      {errorMessage ? <QueryErrorBanner error={errorMessage} onRetry={() => { void publicProfileQuery.refetch(); void photoChangeQuery.refetch(); }} /> : null}
    </KeyboardSafeScrollView>
  );
}

function MetricCard(props: { label: string; value: string; hint: string }) {
  const { label, value, hint } = props;

  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricHint}>{hint}</Text>
    </View>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: 'default' | 'numeric';
  multiline?: boolean;
  editable?: boolean;
}) {
  const { label, value, onChangeText, keyboardType = 'default', multiline = false, editable = true } = props;

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        multiline={multiline}
        editable={editable}
        placeholder={label}
        placeholderTextColor={colors.textPlaceholder}
        style={[
          styles.input,
          multiline ? styles.textarea : null,
          !editable ? styles.readonlyInput : null,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.pageBg,
  },
  content: {
    padding: layout.containerPadding,
    gap: layout.sectionGap,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  metricCard: {
    flex: 1,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.inputBg,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.navy,
  },
  metricHint: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  field: {
    gap: spacing.sm,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  input: {
    minHeight: layout.inputMinHeight,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.inputBg,
    paddingHorizontal: 14,
    fontSize: 15,
    color: colors.navy,
  },
  readonlyInput: {
    backgroundColor: colors.primaryPale,
    color: colors.textMuted,
  },
  textarea: {
    minHeight: layout.inputMinHeightMultiline,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  flexField: {
    flex: 1,
  },
  actions: {
    gap: spacing.md,
  },
  stack: {
    gap: spacing.md,
  },
  metaLine: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  status: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.navy,
  },
});
