import { memo, useCallback } from 'react';
import { FlatList, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatDateTime } from '@/src/lib/formatters';
import { colors, radii, spacing } from '@/src/theme';
import type { ChatMessage } from '@/src/types/api';

type ChatThreadProps = {
  messages: ChatMessage[];
  currentUserId: string;
  locale: string;
  timezone: string;
  emptyLabel?: string;
};

const ChatBubble = memo(function ChatBubble({
  message,
  isOwn,
  locale,
  timezone,
}: {
  message: ChatMessage;
  isOwn: boolean;
  locale: string;
  timezone: string;
}) {
  return (
    <View style={[styles.row, isOwn ? styles.rowOwn : null]}>
      <View
        style={[
          styles.bubble,
          message.isInternal ? styles.bubbleInternal : null,
          isOwn ? styles.bubbleOwn : null,
        ]}
      >
        <Text style={[styles.sender, isOwn ? styles.senderOwn : null]}>
          {message.senderName || message.senderRole || 'Mensaje'}
        </Text>
        {message.isInternal ? (
          <Text style={[styles.internalBadge, isOwn ? styles.internalBadgeOwn : null]}>
            Interno
          </Text>
        ) : null}
        {message.text ? (
          <Text style={[styles.text, isOwn ? styles.textOwn : null]}>{message.text}</Text>
        ) : null}
        {message.attachments.length ? (
          <View style={styles.attachments}>
            {message.attachments.map((attachment, index) => (
              <Pressable
                key={`${message.id}-${index}`}
                accessibilityRole="link"
                accessibilityLabel={`Abrir adjunto ${index + 1}`}
                onPress={() => void Linking.openURL(attachment)}
                style={styles.attachment}
              >
                <Text style={styles.attachmentLabel}>Abrir adjunto {index + 1}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        <Text style={[styles.meta, isOwn ? styles.metaOwn : null]}>
          {formatDateTime(message.createdAt, locale, timezone)}
        </Text>
      </View>
    </View>
  );
});

export const ChatThread = memo(function ChatThread(props: ChatThreadProps) {
  const {
    messages,
    currentUserId,
    locale,
    timezone,
    emptyLabel = 'Todavia no hay mensajes.',
  } = props;

  const renderItem = useCallback(
    ({ item }: { item: ChatMessage }) => (
      <ChatBubble
        message={item}
        isOwn={item.senderId === currentUserId}
        locale={locale}
        timezone={timezone}
      />
    ),
    [currentUserId, locale, timezone],
  );

  const keyExtractor = useCallback((item: ChatMessage) => item.id, []);

  if (!messages.length) {
    return <Text style={styles.empty}>{emptyLabel}</Text>;
  }

  return (
    <FlatList
      data={messages}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      contentContainerStyle={styles.list}
      showsVerticalScrollIndicator={false}
    />
  );
});

const styles = StyleSheet.create({
  list: {
    gap: spacing.md,
  },
  row: {
    alignItems: 'flex-start',
  },
  rowOwn: {
    alignItems: 'flex-end',
  },
  bubble: {
    maxWidth: '88%',
    borderRadius: 18,
    backgroundColor: colors.inputBg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: spacing.xs,
  },
  bubbleOwn: {
    backgroundColor: colors.primary,
  },
  bubbleInternal: {
    backgroundColor: colors.internalBg,
  },
  sender: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.navy,
    textTransform: 'uppercase',
  },
  senderOwn: {
    color: colors.primaryMuted,
  },
  internalBadge: {
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    backgroundColor: colors.warning,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    fontSize: 11,
    fontWeight: '800',
    color: colors.textOnDark,
    textTransform: 'uppercase',
  },
  internalBadgeOwn: {
    backgroundColor: colors.textOnDark,
    color: colors.primary,
  },
  text: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.navy,
  },
  textOwn: {
    color: colors.textOnDark,
  },
  attachments: {
    gap: spacing.sm,
  },
  attachment: {
    alignSelf: 'flex-start',
  },
  attachmentLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primarySoft,
  },
  meta: {
    fontSize: 12,
    color: colors.textMuted,
  },
  metaOwn: {
    color: colors.primaryMuted,
  },
  empty: {
    fontSize: 14,
    color: colors.textMuted,
  },
});
