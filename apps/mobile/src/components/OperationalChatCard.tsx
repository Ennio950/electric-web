import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/src/components/AppButton';
import { colors, radii, spacing } from '@/src/theme';
import { ChatComposer } from '@/src/components/ChatComposer';
import { ChatThread } from '@/src/components/ChatThread';
import { SectionCard } from '@/src/components/SectionCard';
import { compressImageForUpload, uploadImageAsset } from '@/src/lib/imageUpload';
import {
  fetchEmergencyChat,
  fetchRequestChat,
  sendEmergencyChatMessage,
  sendRequestChatMessage,
  withCurrentToken,
} from '@/src/lib/api';
import { captureImageFromCamera, pickImageFromLibrary } from '@/src/lib/media';
import type { MobilePhotoPolicy } from '@/src/types/api';

type OperationalChatCardProps = {
  sourceType: 'request' | 'emergency';
  recordId: string;
  currentUserId: string;
  locale: string;
  timezone: string;
  photoPolicy: MobilePhotoPolicy;
  title?: string;
  subtitle?: string;
  placeholder?: string;
  allowInternalMessages?: boolean;
};

export function OperationalChatCard(props: OperationalChatCardProps) {
  const {
    sourceType,
    recordId,
    currentUserId,
    locale,
    timezone,
    photoPolicy,
    title = 'Chat operativo',
    subtitle = 'Polling simple con adjuntos desde galeria o camara.',
    placeholder = 'Escribe un mensaje',
    allowInternalMessages = false,
  } = props;

  const queryClient = useQueryClient();
  const [draftMessage, setDraftMessage] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<string[]>([]);
  const [isInternalDraft, setIsInternalDraft] = useState(false);
  const queryKey = sourceType === 'request' ? ['request-chat', recordId] : ['emergency-chat', recordId];

  const chatQuery = useQuery({
    queryKey,
    enabled: Boolean(recordId),
    refetchInterval: 5_000,
    queryFn: () =>
      withCurrentToken((token) =>
        sourceType === 'request'
          ? fetchRequestChat(token, recordId)
          : fetchEmergencyChat(token, recordId),
      ),
  });

  const sendChatMutation = useMutation({
    mutationFn: async () => {
      const text = draftMessage.trim();
      if (!text && pendingAttachments.length === 0) {
        return null;
      }

      return withCurrentToken((token) =>
        sourceType === 'request'
          ? sendRequestChatMessage(token, recordId, text, pendingAttachments, { isInternal: allowInternalMessages && isInternalDraft })
          : sendEmergencyChatMessage(token, recordId, text, pendingAttachments, { isInternal: allowInternalMessages && isInternalDraft }),
      );
    },
    onSuccess: async () => {
      setDraftMessage('');
      setPendingAttachments([]);
      setIsInternalDraft(false);
      await queryClient.invalidateQueries({ queryKey });
    },
  });

  const uploadAttachmentMutation = useMutation({
    mutationFn: async (source: 'library' | 'camera') => {
      if (pendingAttachments.length >= 3) {
        throw new Error('Maximo 3 adjuntos por mensaje.');
      }

      const pickedImage = source === 'camera'
        ? await captureImageFromCamera()
        : await pickImageFromLibrary();

      if (!pickedImage) {
        return null;
      }

      const compressed = await compressImageForUpload(pickedImage, photoPolicy);
      return withCurrentToken(async (token) => {
        const upload = await uploadImageAsset({ token, asset: compressed });
        return upload.url;
      });
    },
    onSuccess: (uploadedUrl) => {
      if (!uploadedUrl) {
        return;
      }
      setPendingAttachments((current) => [...current, uploadedUrl].slice(0, 3));
    },
  });

  return (
    <SectionCard title={title} subtitle={subtitle}>
      {chatQuery.error ? (
        <Text style={styles.error}>
          {chatQuery.error instanceof Error ? chatQuery.error.message : 'No se pudo cargar el chat.'}
        </Text>
      ) : null}
      <ChatThread
        messages={chatQuery.data ?? []}
        currentUserId={currentUserId}
        locale={locale}
        timezone={timezone}
      />
      {allowInternalMessages ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => setIsInternalDraft((current) => !current)}
          style={[styles.internalToggle, isInternalDraft ? styles.internalToggleActive : null]}
        >
          <Text style={[styles.internalToggleLabel, isInternalDraft ? styles.internalToggleLabelActive : null]}>
            {isInternalDraft ? 'Mensaje interno activo' : 'Enviar como mensaje interno'}
          </Text>
        </Pressable>
      ) : null}
      <View style={styles.actions}>
        <AppButton
          tone="secondary"
          loading={uploadAttachmentMutation.isPending}
          disabled={sendChatMutation.isPending || pendingAttachments.length >= 3}
          onPress={() => uploadAttachmentMutation.mutate('library')}
        >
          Adjuntar desde galeria
        </AppButton>
        <AppButton
          tone="secondary"
          loading={uploadAttachmentMutation.isPending}
          disabled={sendChatMutation.isPending || pendingAttachments.length >= 3}
          onPress={() => uploadAttachmentMutation.mutate('camera')}
        >
          Tomar foto para chat
        </AppButton>
      </View>
      {pendingAttachments.length ? (
        <View style={styles.attachmentDrafts}>
          {pendingAttachments.map((attachment, index) => (
            <View key={`${attachment}-${index}`} style={styles.attachmentDraft}>
              <Pressable accessibilityRole="link" accessibilityLabel={`Abrir adjunto ${index + 1}`} onPress={() => void Linking.openURL(attachment)}>
                <Text style={styles.attachmentDraftLabel}>Adjunto {index + 1}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`Quitar adjunto ${index + 1}`} onPress={() => setPendingAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))}>
                <Text style={styles.attachmentDraftRemove}>Quitar</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      <ChatComposer
        value={draftMessage}
        onChangeText={setDraftMessage}
        onSend={() => sendChatMutation.mutate()}
        isSending={sendChatMutation.isPending}
        disabled={chatQuery.isLoading}
        canSend={Boolean(draftMessage.trim()) || pendingAttachments.length > 0}
        placeholder={placeholder}
      />
      {uploadAttachmentMutation.error instanceof Error ? <Text style={styles.error}>{uploadAttachmentMutation.error.message}</Text> : null}
      {sendChatMutation.error instanceof Error ? <Text style={styles.error}>{sendChatMutation.error.message}</Text> : null}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: spacing.md,
  },
  internalToggle: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardBg,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  internalToggleActive: {
    borderColor: colors.internalText,
    backgroundColor: colors.internalBg,
  },
  internalToggleLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  internalToggleLabelActive: {
    color: colors.internalText,
  },
  error: {
    fontSize: 14,
    color: colors.error,
  },
  attachmentDrafts: {
    gap: 10,
  },
  attachmentDraft: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radii.md,
    backgroundColor: colors.inputBg,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  attachmentDraftLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  attachmentDraftRemove: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.error,
  },
});
