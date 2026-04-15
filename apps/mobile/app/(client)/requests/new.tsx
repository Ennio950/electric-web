import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/src/components/AppButton';
import { FilterChips } from '@/src/components/FilterChips';
import { FormInput } from '@/src/components/FormInput';
import { KeyboardSafeScrollView } from '@/src/components/KeyboardSafeScrollView';
import { LoadingScreen } from '@/src/components/LoadingScreen';
import { SectionCard } from '@/src/components/SectionCard';
import { createClientRequest, withCurrentToken } from '@/src/lib/api';
import { compressImageForUpload, uploadImageAsset } from '@/src/lib/imageUpload';
import { captureImageFromCamera, pickImageFromLibrary } from '@/src/lib/media';
import { appRoutes, replaceAppRoute } from '@/src/navigation/routes';
import { useSessionStore } from '@/src/stores/sessionStore';
import { colors, spacing } from '@/src/theme';

const CATEGORY_OPTIONS = [
  { label: 'Electricidad', value: 'electricidad' },
  { label: 'Plomeria', value: 'plomeria' },
  { label: 'General', value: 'general' },
];

export default function ClientRequestNewScreen() {
  const bootstrap = useSessionStore((state) => state.bootstrap);
  const queryClient = useQueryClient();
  const [category, setCategory] = useState('electricidad');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');

  const canSubmit = useMemo(() => {
    return Boolean(address.trim() && description.trim());
  }, [address, description]);

  const createMutation = useMutation({
    mutationFn: () =>
      withCurrentToken((token) =>
        createClientRequest(token, {
          category,
          address: address.trim(),
          description: description.trim(),
          photoUrl: photoUrl.trim() || undefined,
        }),
      ),
    onSuccess: async (request) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['client-requests'] }),
        queryClient.invalidateQueries({ queryKey: ['mobile-home'] }),
      ]);
      replaceAppRoute(appRoutes.clientRequestDetail(request.id));
    },
  });

  const uploadPhotoMutation = useMutation({
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
    onSuccess: (uploadedUrl) => {
      if (uploadedUrl) {
        setPhotoUrl(uploadedUrl);
      }
    },
  });

  if (!bootstrap) {
    return <LoadingScreen label="Preparando formulario..." />;
  }

  return (
    <KeyboardSafeScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <SectionCard
        title="Nueva solicitud"
        subtitle="Abre un request nuevo y opcionalmente adjunta una foto desde galeria o camara."
      >
        <Text style={styles.chipLabel}>Categoria</Text>
        <FilterChips value={category} onChange={setCategory} options={CATEGORY_OPTIONS} />

        <FormInput
          label="Direccion"
          placeholder="Direccion del servicio"
          value={address}
          onChangeText={setAddress}
        />

        <FormInput
          label="Descripcion"
          multiline
          numberOfLines={5}
          placeholder="Que necesitas que resolvamos"
          value={description}
          onChangeText={setDescription}
        />

        <View style={styles.actions}>
          <AppButton
            tone="secondary"
            loading={uploadPhotoMutation.isPending}
            disabled={createMutation.isPending}
            onPress={() => uploadPhotoMutation.mutate('library')}
          >
            Foto desde galeria
          </AppButton>
          <AppButton
            tone="secondary"
            loading={uploadPhotoMutation.isPending}
            disabled={createMutation.isPending}
            onPress={() => uploadPhotoMutation.mutate('camera')}
          >
            Tomar foto
          </AppButton>
        </View>

        <FormInput
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="https://... (fallback manual)"
          value={photoUrl}
          onChangeText={setPhotoUrl}
        />

        <AppButton
          loading={createMutation.isPending}
          disabled={!canSubmit || uploadPhotoMutation.isPending}
          onPress={() => createMutation.mutate()}
        >
          Crear solicitud
        </AppButton>

        {uploadPhotoMutation.error instanceof Error ? <Text style={styles.error}>{uploadPhotoMutation.error.message}</Text> : null}
        {createMutation.error instanceof Error ? <Text style={styles.error}>{createMutation.error.message}</Text> : null}
      </SectionCard>
    </KeyboardSafeScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.pageBg,
  },
  content: {
    padding: spacing.xl,
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.navyLabel,
  },
  actions: {
    gap: spacing.md,
  },
  error: {
    fontSize: 14,
    color: colors.error,
  },
});
