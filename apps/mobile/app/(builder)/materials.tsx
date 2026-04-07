import type { MaterialCatalogItem } from '@electric/estimator-core';
import { useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '@/src/components/AppButton';
import { SectionCard } from '@/src/components/SectionCard';
import {
  batchUpsertCatalogMaterials,
  deleteCatalogMaterial,
  fetchCatalogMaterials,
  upsertCatalogMaterial,
  withCurrentToken,
} from '@/src/lib/api';
import { useBuilderStore } from '@/src/stores/builderStore';
import { useSessionStore } from '@/src/stores/sessionStore';

export default function BuilderMaterialsScreen() {
  const bootstrap = useSessionStore((state) => state.bootstrap);
  const materials = useBuilderStore((state) => state.materials);
  const createMaterial = useBuilderStore((state) => state.createMaterial);
  const saveMaterial = useBuilderStore((state) => state.saveMaterial);
  const removeMaterial = useBuilderStore((state) => state.removeMaterial);
  const importSnapshot = useBuilderStore((state) => state.importSnapshot);
  const exportSnapshot = useBuilderStore((state) => state.exportSnapshot);

  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error'>('idle');
  const [isPushingAll, setIsPushingAll] = useState(false);
  const hasSyncedRef = useRef(false);

  // Pull materials from server on first mount
  useEffect(() => {
    if (hasSyncedRef.current) return;
    hasSyncedRef.current = true;

    void (async () => {
      setSyncStatus('syncing');
      try {
        const serverMaterials = await withCurrentToken((token) => fetchCatalogMaterials(token));
        if (serverMaterials.length > 0) {
          const snapshot = exportSnapshot();
          importSnapshot({ ...snapshot, materials: serverMaterials as MaterialCatalogItem[] });
        }
        setSyncStatus('idle');
      } catch {
        setSyncStatus('error');
      }
    })();
  }, [exportSnapshot, importSnapshot]);

  async function handleSaveMaterial(material: MaterialCatalogItem) {
    saveMaterial(material);
    try {
      await withCurrentToken((token) =>
        upsertCatalogMaterial(token, material as never),
      );
    } catch {
      // Local save already done — backend failure is non-blocking
    }
  }

  async function handleDeleteMaterial(materialId: string) {
    removeMaterial(materialId);
    try {
      await withCurrentToken((token) => deleteCatalogMaterial(token, materialId));
    } catch {
      // Local delete already done — backend failure is non-blocking
    }
  }

  async function handlePushAllToServer() {
    if (materials.length === 0) {
      Alert.alert('Sin materiales', 'No hay materiales locales para sincronizar.');
      return;
    }
    setIsPushingAll(true);
    try {
      await withCurrentToken((token) =>
        batchUpsertCatalogMaterials(token, materials as never[]),
      );
      Alert.alert('Sincronizado', `${materials.length} materiales subidos al servidor.`);
    } catch (err) {
      Alert.alert(
        'Error al sincronizar',
        err instanceof Error ? err.message : 'No se pudo subir el catalogo.',
      );
    } finally {
      setIsPushingAll(false);
    }
  }

  if (!bootstrap) {
    return null;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <SectionCard
        title="Catálogo de materiales"
        subtitle={
          syncStatus === 'syncing'
            ? 'Sincronizando con el servidor...'
            : syncStatus === 'error'
              ? 'Sin conexion — mostrando catalogo local.'
              : `${materials.length} materiales · sincronizado`
        }
      >
        <View style={styles.buttonRow}>
          <AppButton onPress={() => {
            const m = createMaterial(bootstrap.companyConfig.currency);
            void withCurrentToken((token) => upsertCatalogMaterial(token, m as never)).catch(() => undefined);
          }}>
            Agregar material
          </AppButton>
          <AppButton tone="secondary" loading={isPushingAll} onPress={() => void handlePushAllToServer()}>
            Subir todo
          </AppButton>
        </View>
      </SectionCard>

      {materials.map((material) => (
        <MaterialEditorCard
          key={material.id}
          material={material}
          onSave={(m) => void handleSaveMaterial(m)}
          onDelete={() => void handleDeleteMaterial(material.id)}
        />
      ))}
    </ScrollView>
  );
}

function MaterialEditorCard(props: {
  material: MaterialCatalogItem;
  onSave: (material: MaterialCatalogItem) => void;
  onDelete: () => void;
}) {
  const { material, onSave, onDelete } = props;
  const [name, setName] = useState(material.name);
  const [category, setCategory] = useState(material.category);
  const [baseUnit, setBaseUnit] = useState(material.baseUnit);
  const [unitPrice, setUnitPrice] = useState(String(material.unitPrice));
  const [density, setDensity] = useState(material.densityKgPerM3 ? String(material.densityKgPerM3) : '');
  const [conversionsText, setConversionsText] = useState(JSON.stringify(material.conversions, null, 2));
  const [error, setError] = useState<string | null>(null);

  const handleSave = () => {
    try {
      const conversions = JSON.parse(conversionsText);
      if (!Array.isArray(conversions)) {
        throw new Error('conversions debe ser un arreglo JSON.');
      }

      onSave({
        ...material,
        name: name.trim() || material.name,
        category: category.trim() || 'general',
        baseUnit: baseUnit.trim() || 'unit',
        unitPrice: Number(unitPrice) || 0,
        densityKgPerM3: density.trim() ? Number(density) || undefined : undefined,
        conversions,
      });
      setError(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar el material.');
    }
  };

  return (
    <SectionCard title={material.name} subtitle={material.id}>
      <Field label="Nombre" value={name} onChangeText={setName} />
      <Field label="Categoría" value={category} onChangeText={setCategory} />
      <View style={styles.row}>
        <View style={styles.flexField}>
          <Field label="Unidad base" value={baseUnit} onChangeText={setBaseUnit} />
        </View>
        <View style={styles.flexField}>
          <Field label="Precio unitario" value={unitPrice} keyboardType="numeric" onChangeText={setUnitPrice} />
        </View>
      </View>
      <Field
        label="Densidad kg/m3"
        value={density}
        keyboardType="numeric"
        onChangeText={setDensity}
      />
      <Field
        label="Conversions JSON"
        value={conversionsText}
        multiline
        onChangeText={setConversionsText}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.buttonRow}>
        <AppButton tone="secondary" onPress={handleSave}>Guardar</AppButton>
        <AppButton tone="danger" onPress={onDelete}>Eliminar</AppButton>
      </View>
    </SectionCard>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: 'default' | 'numeric';
  multiline?: boolean;
}) {
  const { label, value, onChangeText, keyboardType = 'default', multiline = false } = props;

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        multiline={multiline}
        style={[styles.input, multiline ? styles.textarea : null]}
        placeholder={label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F7FB'
  },
  content: {
    padding: 20,
    gap: 16
  },
  field: {
    gap: 8
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: '#6B778C'
  },
  input: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#C7D5EA',
    backgroundColor: '#F8FAFD',
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#10233F'
  },
  textarea: {
    minHeight: 120,
    paddingTop: 12,
    textAlignVertical: 'top'
  },
  row: {
    flexDirection: 'row',
    gap: 12
  },
  flexField: {
    flex: 1
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12
  },
  error: {
    fontSize: 13,
    color: '#B42318'
  }
});
