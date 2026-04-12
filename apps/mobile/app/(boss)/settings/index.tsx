import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '@/src/components/AppButton';
import { LoadingScreen } from '@/src/components/LoadingScreen';
import { SectionCard } from '@/src/components/SectionCard';
import {
  fetchBossCompanyConfig,
  fetchBossNotificationSettings,
  fetchBossNotificationChannels,
  sendBossTelegramTest,
  sendBossWhatsappTest,
  updateBossCompanyConfig,
  updateBossNotificationSettings,
  withCurrentToken,
} from '@/src/lib/api';
import { useSessionStore } from '@/src/stores/sessionStore';
import { colors, radii, spacing } from '@/src/theme';

export default function BossSettingsScreen() {
  const bootstrap = useSessionStore((state) => state.bootstrap);
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState('');
  const [tagline, setTagline] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [timezone, setTimezone] = useState('');
  const [locale, setLocale] = useState('');
  const [currency, setCurrency] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [whatsappTransport, setWhatsappTransport] = useState('noop');
  const [whatsappAlertNumber, setWhatsappAlertNumber] = useState('');
  const [whatsappWebhookUrl, setWhatsappWebhookUrl] = useState('');
  const [whatsappWebhookToken, setWhatsappWebhookToken] = useState('');
  const [twilioAccountSid, setTwilioAccountSid] = useState('');
  const [twilioAuthToken, setTwilioAuthToken] = useState('');
  const [twilioWhatsAppFrom, setTwilioWhatsAppFrom] = useState('');
  const [twilioMessagingServiceSid, setTwilioMessagingServiceSid] = useState('');
  const [twilioStatusCallbackUrl, setTwilioStatusCallbackUrl] = useState('');
  const [telegramTransport, setTelegramTransport] = useState('disabled');
  const [telegramBotToken, setTelegramBotToken] = useState('');
  const [telegramDefaultChatId, setTelegramDefaultChatId] = useState('');
  const [whatsappMessage, setWhatsappMessage] = useState('Prueba desde app nativa boss.');
  const [telegramMessage, setTelegramMessage] = useState('Prueba desde app nativa boss.');

  const companyConfigQuery = useQuery({
    queryKey: ['boss-company-config'],
    queryFn: () => withCurrentToken(fetchBossCompanyConfig),
  });

  const channelsQuery = useQuery({
    queryKey: ['boss-notification-channels'],
    queryFn: () => withCurrentToken(fetchBossNotificationChannels),
  });

  const notificationSettingsQuery = useQuery({
    queryKey: ['boss-notification-settings'],
    queryFn: () => withCurrentToken(fetchBossNotificationSettings),
  });

  useEffect(() => {
    const config = companyConfigQuery.data;
    if (!config) {
      return;
    }

    setDisplayName(config.displayName || '');
    setTagline(config.tagline || '');
    setPhone(config.phone || '');
    setWhatsappNumber(config.whatsappNumber || '');
    setTimezone(config.timezone || '');
    setLocale(config.locale || '');
    setCurrency(config.currency || '');
    setEmail(config.email || '');
    setAddress(config.address || '');
  }, [companyConfigQuery.data]);

  useEffect(() => {
    const settings = notificationSettingsQuery.data;
    if (!settings) {
      return;
    }

    setWhatsappTransport(settings.whatsapp.transport || 'noop');
    setWhatsappAlertNumber(settings.whatsapp.alertNumber || '');
    setWhatsappWebhookUrl(settings.whatsapp.webhookUrl || '');
    setTwilioAccountSid(settings.whatsapp.twilioAccountSid || '');
    setTwilioWhatsAppFrom(settings.whatsapp.twilioWhatsAppFrom || '');
    setTwilioMessagingServiceSid(settings.whatsapp.twilioMessagingServiceSid || '');
    setTwilioStatusCallbackUrl(settings.whatsapp.twilioStatusCallbackUrl || '');
    setTelegramTransport(settings.telegram.transport || 'disabled');
    setTelegramDefaultChatId(settings.telegram.defaultChatId || '');
  }, [notificationSettingsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () => withCurrentToken((token) => updateBossCompanyConfig(token, {
      displayName,
      tagline,
      phone,
      whatsappNumber,
      timezone,
      locale,
      currency,
      email,
      address,
    })),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['boss-company-config'] }),
        queryClient.invalidateQueries({ queryKey: ['mobile-bootstrap'] }),
      ]);
    },
  });

  const whatsappTestMutation = useMutation({
    mutationFn: () => withCurrentToken((token) => sendBossWhatsappTest(token, { message: whatsappMessage })),
  });

  const telegramTestMutation = useMutation({
    mutationFn: () => withCurrentToken((token) => sendBossTelegramTest(token, { message: telegramMessage })),
  });

  const saveNotificationSettingsMutation = useMutation({
    mutationFn: () => withCurrentToken((token) => updateBossNotificationSettings(token, {
      whatsapp: {
        alertNumber: whatsappAlertNumber,
        transport: whatsappTransport,
        webhookUrl: whatsappWebhookUrl,
        webhookToken: whatsappWebhookToken,
        twilioAccountSid,
        twilioAuthToken,
        twilioWhatsAppFrom,
        twilioMessagingServiceSid,
        twilioStatusCallbackUrl,
      },
      telegram: {
        transport: telegramTransport,
        botToken: telegramBotToken,
        defaultChatId: telegramDefaultChatId,
      },
    })),
    onSuccess: async () => {
      setWhatsappWebhookToken('');
      setTwilioAuthToken('');
      setTelegramBotToken('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['boss-notification-settings'] }),
        queryClient.invalidateQueries({ queryKey: ['boss-notification-channels'] }),
      ]);
    },
  });

  if (!bootstrap) {
    return <LoadingScreen label="Cargando settings..." />;
  }

  const errorMessage =
    companyConfigQuery.error instanceof Error
      ? companyConfigQuery.error.message
      : channelsQuery.error instanceof Error
        ? channelsQuery.error.message
        : notificationSettingsQuery.error instanceof Error
          ? notificationSettingsQuery.error.message
        : saveMutation.error instanceof Error
          ? saveMutation.error.message
          : saveNotificationSettingsMutation.error instanceof Error
            ? saveNotificationSettingsMutation.error.message
          : whatsappTestMutation.error instanceof Error
            ? whatsappTestMutation.error.message
            : telegramTestMutation.error instanceof Error
              ? telegramTestMutation.error.message
              : null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={companyConfigQuery.isRefetching || channelsQuery.isRefetching}
          onRefresh={() => {
            void Promise.all([companyConfigQuery.refetch(), channelsQuery.refetch(), notificationSettingsQuery.refetch()]);
          }}
        />
      }
    >
      <SectionCard title="Empresa" subtitle="Config basica usada por móvil y web.">
        {companyConfigQuery.isLoading ? <LoadingScreen variant="skeleton" /> : null}
        <Field label="Display name" value={displayName} onChangeText={setDisplayName} />
        <Field label="Tagline" value={tagline} onChangeText={setTagline} />
        <Field label="Phone" value={phone} onChangeText={setPhone} />
        <Field label="WhatsApp" value={whatsappNumber} onChangeText={setWhatsappNumber} />
        <Field label="Timezone" value={timezone} onChangeText={setTimezone} />
        <View style={styles.row}>
          <View style={styles.flexField}>
            <Field label="Locale" value={locale} onChangeText={setLocale} />
          </View>
          <View style={styles.flexField}>
            <Field label="Currency" value={currency} onChangeText={setCurrency} />
          </View>
        </View>
        <Field label="Email" value={email} onChangeText={setEmail} />
        <Field label="Address" value={address} onChangeText={setAddress} multiline />
        <AppButton loading={saveMutation.isPending} onPress={() => saveMutation.mutate()}>
          Guardar configuracion
        </AppButton>
      </SectionCard>

      <SectionCard title="Canales" subtitle="Estado actual de WhatsApp y Telegram.">
        {channelsQuery.isLoading ? <LoadingScreen variant="skeleton" /> : null}
        {channelsQuery.data ? (
          <View style={styles.stack}>
            <ChannelCard
              title="WhatsApp"
              mode={channelsQuery.data.whatsapp.mode}
              transport={channelsQuery.data.whatsapp.transport}
              recipient={channelsQuery.data.whatsapp.configuredRecipientPreview}
              notes={channelsQuery.data.whatsapp.notes}
            />
            <ChannelCard
              title="Telegram"
              mode={channelsQuery.data.telegram.mode}
              transport={channelsQuery.data.telegram.transport}
              recipient={channelsQuery.data.telegram.configuredRecipientPreview}
              notes={channelsQuery.data.telegram.notes}
            />
          </View>
        ) : null}
      </SectionCard>

      <SectionCard title="Notification settings" subtitle="Transportes, destinatarios y credenciales opcionales.">
        {notificationSettingsQuery.isLoading ? <LoadingScreen variant="skeleton" /> : null}
        {notificationSettingsQuery.data ? (
          <View style={styles.stack}>
            <Field label="WhatsApp transport" value={whatsappTransport} onChangeText={setWhatsappTransport} />
            <Field label="WhatsApp alert number" value={whatsappAlertNumber} onChangeText={setWhatsappAlertNumber} />
            <Field label="Webhook URL" value={whatsappWebhookUrl} onChangeText={setWhatsappWebhookUrl} />
            <Field
              label={notificationSettingsQuery.data.whatsapp.hasWebhookToken ? 'Webhook token (dejar vacío para conservar)' : 'Webhook token'}
              value={whatsappWebhookToken}
              onChangeText={setWhatsappWebhookToken}
            />
            <Field label="Twilio account SID" value={twilioAccountSid} onChangeText={setTwilioAccountSid} />
            <Field
              label={notificationSettingsQuery.data.whatsapp.hasTwilioAuthToken ? 'Twilio auth token (dejar vacío para conservar)' : 'Twilio auth token'}
              value={twilioAuthToken}
              onChangeText={setTwilioAuthToken}
            />
            <Field label="Twilio WhatsApp from" value={twilioWhatsAppFrom} onChangeText={setTwilioWhatsAppFrom} />
            <Field label="Messaging service SID" value={twilioMessagingServiceSid} onChangeText={setTwilioMessagingServiceSid} />
            <Field label="Twilio callback URL" value={twilioStatusCallbackUrl} onChangeText={setTwilioStatusCallbackUrl} />
            <Field label="Telegram transport" value={telegramTransport} onChangeText={setTelegramTransport} />
            <Field label="Telegram default chat ID" value={telegramDefaultChatId} onChangeText={setTelegramDefaultChatId} />
            <Field
              label={notificationSettingsQuery.data.telegram.hasBotToken ? 'Telegram bot token (dejar vacío para conservar)' : 'Telegram bot token'}
              value={telegramBotToken}
              onChangeText={setTelegramBotToken}
            />
            <AppButton loading={saveNotificationSettingsMutation.isPending} onPress={() => saveNotificationSettingsMutation.mutate()}>
              Guardar notification settings
            </AppButton>
          </View>
        ) : null}
      </SectionCard>

      <SectionCard title="Pruebas" subtitle="Dispara un test manual desde el móvil del boss.">
        <Field label="Mensaje WhatsApp" value={whatsappMessage} onChangeText={setWhatsappMessage} multiline />
        <AppButton
          tone="secondary"
          loading={whatsappTestMutation.isPending}
          onPress={() => whatsappTestMutation.mutate()}
        >
          Enviar prueba WhatsApp
        </AppButton>
        <Field label="Mensaje Telegram" value={telegramMessage} onChangeText={setTelegramMessage} multiline />
        <AppButton
          tone="secondary"
          loading={telegramTestMutation.isPending}
          onPress={() => telegramTestMutation.mutate()}
        >
          Enviar prueba Telegram
        </AppButton>
      </SectionCard>

      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
    </ScrollView>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  multiline?: boolean;
}) {
  const { label, value, onChangeText, multiline = false } = props;

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        style={[styles.input, multiline ? styles.textarea : null]}
        placeholder={label}
      />
    </View>
  );
}

function ChannelCard(props: {
  title: string;
  mode: string;
  transport: string;
  recipient: string;
  notes: string[];
}) {
  const { title, mode, transport, recipient, notes } = props;

  return (
    <View style={styles.channelCard}>
      <Text style={styles.channelTitle}>{title}</Text>
      <Text style={styles.channelMeta}>{`Modo: ${mode} · Transport: ${transport}`}</Text>
      <Text style={styles.channelMeta}>{recipient ? `Destino: ${recipient}` : 'Sin destino configurado'}</Text>
      {notes.map((note) => (
        <Text key={`${title}-${note}`} style={styles.note}>{`\u2022 ${note}`}</Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.pageBg,
  },
  content: {
    padding: spacing.xl,
    gap: spacing.lg,
  },
  field: {
    gap: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  input: {
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.inputBg,
    paddingHorizontal: 14,
    fontSize: 15,
    color: colors.navy,
  },
  textarea: {
    minHeight: 88,
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
  stack: {
    gap: spacing.md,
  },
  channelCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.inputBg,
    padding: 14,
    gap: 6,
  },
  channelTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.navy,
  },
  channelMeta: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  note: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 20,
  },
  error: {
    fontSize: 14,
    color: colors.error,
  },
});
