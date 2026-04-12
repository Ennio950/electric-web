import type { MaterialCatalogItem } from '@electric/estimator-core';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '@/src/components/AppButton';
import { SectionCard } from '@/src/components/SectionCard';
import { useBuilderStore } from '@/src/stores/builderStore';
import { useSessionStore } from '@/src/stores/sessionStore';
import { colors, radii, spacing } from '@/src/theme';

export default function BuilderMaterialsScreen() {
  const bootstrap = useSessionStore((state) => state.bootstrap);
  const materials = useBuilderStore((state) => state.materials);
  const createMaterial = useBuilderStore((state) => state.createMaterial);
  const saveMaterial = useBuilderStore((state) => state.saveMaterial);
  const removeMaterial = useBuilderStore((state) => state.removeMaterial);

  if (!bootstrap) {
    return null;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <SectionCard
        title="Catálogo de materiales"
        subtitle="Soporta precio, unidad base, densidad y conversiones personalizadas del material."
      >
        <AppButton onPress={() => createMaterial(bootstrap.companyConfig.currency)}>Agregar material</AppButton>
      </SectionCard>

      {materials.map((material) => (
        <MaterialEditorCard
          key={material.id}
          material={material}
          onSave={saveMaterial}
          onDelete={() => removeMaterial(material.id)}
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
    backgroundColor: colors.pageBg
  },
  content: {
    padding: spacing.xl,
    gap: spacing.lg
  },
  field: {
    gap: 8
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.textMuted
  },
  input: {
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    backgroundColor: colors.inputBg,
    paddingHorizontal: 14,
    fontSize: 15,
    color: colors.navy
  },
  textarea: {
    minHeight: 120,
    paddingTop: 12,
    textAlignVertical: 'top'
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md
  },
  flexField: {
    flex: 1
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.md
  },
  error: {
    fontSize: 13,
    color: colors.error
  }
});
