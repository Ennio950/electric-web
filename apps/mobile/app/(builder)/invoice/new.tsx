import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '@/src/components/AppButton';
import { SectionCard } from '@/src/components/SectionCard';
import { createInvoice, invoicePdfPath, withCurrentToken } from '@/src/lib/api';
import { buildApiUrl } from '@/src/config/mobileEnv';
import { useSessionStore } from '@/src/stores/sessionStore';
import { auth } from '@/src/config/firebase';

type LineItem = {
  key: string;
  desc: string;
  type: 'Service' | 'Material';
  qty: string;
  price: string;
};

function makeItem(): LineItem {
  return { key: String(Date.now() + Math.random()), desc: '', type: 'Service', qty: '1', price: '0' };
}

export default function NewInvoiceScreen() {
  const bootstrap = useSessionStore((state) => state.bootstrap);
  const currency = bootstrap?.companyConfig.currency ?? 'GTQ';
  const locale = bootstrap?.companyConfig.locale ?? 'es-GT';

  const [clientName, setClientName] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [taxPct, setTaxPct] = useState('12');
  const [items, setItems] = useState<LineItem[]>([makeItem()]);
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [savedInvoiceId, setSavedInvoiceId] = useState<string | null>(null);
  const [savedInvoiceNumber, setSavedInvoiceNumber] = useState<string | null>(null);

  function updateItem(key: string, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }

  function removeItem(key: string) {
    setItems((prev) => prev.filter((item) => item.key !== key));
  }

  const subtotal = items.reduce((sum, item) => {
    const qty = parseFloat(item.qty) || 0;
    const price = parseFloat(item.price) || 0;
    return sum + qty * price;
  }, 0);

  const tax = parseFloat(taxPct) || 0;
  const taxAmount = subtotal * (tax / 100);
  const total = subtotal + taxAmount;

  const fmt = new Intl.NumberFormat(locale, { style: 'currency', currency }).format;

  async function handleSave() {
    if (!clientName.trim()) {
      Alert.alert('Falta dato', 'El nombre del cliente es requerido.');
      return;
    }
    if (items.length === 0) {
      Alert.alert('Falta dato', 'Agrega al menos un item.');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        clientName: clientName.trim(),
        clientAddress: clientAddress.trim(),
        items: items.map((item) => ({
          desc: item.desc.trim() || 'Item',
          type: item.type,
          qty: parseFloat(item.qty) || 1,
          price: parseFloat(item.price) || 0,
          amount: (parseFloat(item.qty) || 1) * (parseFloat(item.price) || 0),
        })),
        taxPct: parseFloat(taxPct) || 0,
        currency,
        dueDate: dueDate.trim() || undefined,
        notes: notes.trim() || undefined,
      };

      const { invoiceId, invoiceNumber } = await withCurrentToken((token) =>
        createInvoice(token, payload),
      );
      setSavedInvoiceId(invoiceId);
      setSavedInvoiceNumber(invoiceNumber);
      Alert.alert('Factura guardada', `Número: ${invoiceNumber}`);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo guardar la factura.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDownloadPdf() {
    if (!savedInvoiceId) {
      Alert.alert('Guarda primero', 'Guarda la factura antes de descargar el PDF.');
      return;
    }

    setIsDownloading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        Alert.alert('Sin sesión', 'Vuelve a iniciar sesión.');
        return;
      }

      const apiPath = invoicePdfPath(savedInvoiceId);
      const url = buildApiUrl(apiPath);
      const localUri = `${FileSystem.cacheDirectory}invoice_${savedInvoiceNumber ?? savedInvoiceId}.pdf`;

      const { status } = await FileSystem.downloadAsync(url, localUri, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (status !== 200) {
        Alert.alert('Error', 'No se pudo descargar el PDF.');
        return;
      }

      await Sharing.shareAsync(localUri, {
        mimeType: 'application/pdf',
        dialogTitle: `Factura ${savedInvoiceNumber ?? ''}`,
      });
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo descargar el PDF.');
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <SectionCard title="Datos del cliente" subtitle="Información para el encabezado de la factura.">
        <Field label="Nombre *" value={clientName} onChangeText={setClientName} placeholder="Ej. Juan Pérez" />
        <Field label="Dirección" value={clientAddress} onChangeText={setClientAddress} placeholder="Dirección de facturación" />
        <Field label="Fecha de vencimiento" value={dueDate} onChangeText={setDueDate} placeholder="YYYY-MM-DD" />
      </SectionCard>

      <SectionCard
        title="Items"
        subtitle={`${items.length} items · Subtotal ${fmt(subtotal)}`}
      >
        {items.map((item) => (
          <View key={item.key} style={styles.itemCard}>
            <Field label="Descripción" value={item.desc} onChangeText={(v) => updateItem(item.key, { desc: v })} placeholder="Ej. Mano de obra" />
            <View style={styles.row}>
              <View style={styles.flex}>
                <Field label="Cant." value={item.qty} onChangeText={(v) => updateItem(item.key, { qty: v })} placeholder="1" keyboardType="numeric" />
              </View>
              <View style={styles.flex}>
                <Field label="Precio unit." value={item.price} onChangeText={(v) => updateItem(item.key, { price: v })} placeholder="0.00" keyboardType="numeric" />
              </View>
            </View>
            <View style={styles.itemFooter}>
              <Text style={styles.itemTotal}>{fmt((parseFloat(item.qty) || 0) * (parseFloat(item.price) || 0))}</Text>
              <AppButton tone="danger" onPress={() => removeItem(item.key)}>Quitar</AppButton>
            </View>
          </View>
        ))}

        <AppButton tone="secondary" onPress={() => setItems((prev) => [...prev, makeItem()])}>
          + Agregar item
        </AppButton>
      </SectionCard>

      <SectionCard title="Totales">
        <Field label="IVA %" value={taxPct} onChangeText={setTaxPct} placeholder="12" keyboardType="numeric" />
        <View style={styles.totalsBlock}>
          <TotalRow label="Subtotal" value={fmt(subtotal)} />
          <TotalRow label={`IVA (${taxPct}%)`} value={fmt(taxAmount)} />
          <TotalRow label="TOTAL" value={fmt(total)} bold />
        </View>
      </SectionCard>

      <SectionCard title="Notas">
        <Field label="Notas (opcional)" value={notes} onChangeText={setNotes} placeholder="Condiciones de pago, términos, etc." multiline />
      </SectionCard>

      <SectionCard title="Acciones">
        {savedInvoiceNumber ? (
          <Text style={styles.savedLabel}>Factura guardada: {savedInvoiceNumber}</Text>
        ) : null}
        <View style={styles.buttonRow}>
          <AppButton loading={isSaving} onPress={() => void handleSave()}>
            {savedInvoiceId ? 'Guardada ✓' : 'Guardar factura'}
          </AppButton>
          <AppButton
            tone="secondary"
            loading={isDownloading}
            disabled={!savedInvoiceId}
            onPress={() => void handleDownloadPdf()}
          >
            Descargar PDF
          </AppButton>
        </View>
      </SectionCard>
    </ScrollView>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'numeric' | 'email-address';
}) {
  const { label, value, onChangeText, placeholder, multiline = false, keyboardType = 'default' } = props;
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        multiline={multiline}
        keyboardType={keyboardType}
        style={[styles.input, multiline && styles.textarea]}
      />
    </View>
  );
}

function TotalRow(props: { label: string; value: string; bold?: boolean }) {
  const { label, value, bold = false } = props;
  return (
    <View style={styles.totalRow}>
      <Text style={[styles.totalLabel, bold && styles.totalBold]}>{label}</Text>
      <Text style={[styles.totalValue, bold && styles.totalBold]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FB' },
  content: { padding: 20, gap: 16 },
  field: { gap: 6 },
  fieldLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', color: '#6B778C', letterSpacing: 0.5 },
  input: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#C7D5EA',
    backgroundColor: '#F8FAFD',
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#10233F',
  },
  textarea: { minHeight: 100, paddingTop: 12, textAlignVertical: 'top' },
  itemCard: { borderRadius: 16, borderWidth: 1, borderColor: '#D8E2F0', padding: 14, gap: 10, backgroundColor: '#FAFCFF' },
  itemFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemTotal: { fontSize: 15, fontWeight: '700', color: '#10233F' },
  row: { flexDirection: 'row', gap: 12 },
  flex: { flex: 1 },
  totalsBlock: { gap: 8, borderTopWidth: 1, borderTopColor: '#D8E2F0', paddingTop: 12, marginTop: 4 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  totalLabel: { fontSize: 14, color: '#4A5970' },
  totalValue: { fontSize: 14, color: '#10233F' },
  totalBold: { fontWeight: '800', fontSize: 17 },
  buttonRow: { flexDirection: 'row', gap: 12 },
  savedLabel: { fontSize: 14, fontWeight: '700', color: '#1A73E8', marginBottom: 8 },
});
