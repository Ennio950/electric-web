import type { Recipe } from '@electric/estimator-core';
import { useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '@/src/components/AppButton';
import { SectionCard } from '@/src/components/SectionCard';
import {
  batchUpsertCatalogRecipes,
  deleteCatalogRecipe,
  fetchCatalogRecipes,
  upsertCatalogRecipe,
  withCurrentToken,
} from '@/src/lib/api';
import { useBuilderStore } from '@/src/stores/builderStore';

export default function BuilderRecipesScreen() {
  const recipes = useBuilderStore((state) => state.recipes);
  const createRecipe = useBuilderStore((state) => state.createRecipe);
  const saveRecipe = useBuilderStore((state) => state.saveRecipe);
  const removeRecipe = useBuilderStore((state) => state.removeRecipe);
  const importSnapshot = useBuilderStore((state) => state.importSnapshot);
  const exportSnapshot = useBuilderStore((state) => state.exportSnapshot);

  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error'>('idle');
  const [isPushingAll, setIsPushingAll] = useState(false);
  const hasSyncedRef = useRef(false);

  // Pull recipes from server on first mount
  useEffect(() => {
    if (hasSyncedRef.current) return;
    hasSyncedRef.current = true;

    void (async () => {
      setSyncStatus('syncing');
      try {
        const serverRecipes = await withCurrentToken((token) => fetchCatalogRecipes(token));
        if (serverRecipes.length > 0) {
          const snapshot = exportSnapshot();
          importSnapshot({ ...snapshot, recipes: serverRecipes as Recipe[] });
        }
        setSyncStatus('idle');
      } catch {
        setSyncStatus('error');
      }
    })();
  }, [exportSnapshot, importSnapshot]);

  async function handleSaveRecipe(recipe: Recipe) {
    saveRecipe(recipe);
    try {
      await withCurrentToken((token) =>
        upsertCatalogRecipe(token, recipe as never),
      );
    } catch {
      // Local save already done — backend failure is non-blocking
    }
  }

  async function handleDeleteRecipe(recipeId: string) {
    removeRecipe(recipeId);
    try {
      await withCurrentToken((token) => deleteCatalogRecipe(token, recipeId));
    } catch {
      // Local delete already done — backend failure is non-blocking
    }
  }

  async function handlePushAllToServer() {
    if (recipes.length === 0) {
      Alert.alert('Sin recetas', 'No hay recetas locales para sincronizar.');
      return;
    }
    setIsPushingAll(true);
    try {
      await withCurrentToken((token) =>
        batchUpsertCatalogRecipes(token, recipes as never[]),
      );
      Alert.alert('Sincronizado', `${recipes.length} recetas subidas al servidor.`);
    } catch (err) {
      Alert.alert(
        'Error al sincronizar',
        err instanceof Error ? err.message : 'No se pudo subir el catalogo.',
      );
    } finally {
      setIsPushingAll(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <SectionCard
        title="Catálogo de recetas"
        subtitle={
          syncStatus === 'syncing'
            ? 'Sincronizando con el servidor...'
            : syncStatus === 'error'
              ? 'Sin conexion — mostrando catalogo local.'
              : `${recipes.length} recetas · sincronizado`
        }
      >
        <View style={styles.buttonRow}>
          <AppButton onPress={() => {
            const r = createRecipe();
            void withCurrentToken((token) => upsertCatalogRecipe(token, r as never)).catch(() => undefined);
          }}>
            Agregar receta
          </AppButton>
          <AppButton tone="secondary" loading={isPushingAll} onPress={() => void handlePushAllToServer()}>
            Subir todo
          </AppButton>
        </View>
      </SectionCard>

      {recipes.map((recipe) => (
        <RecipeEditorCard
          key={recipe.id}
          recipe={recipe}
          onSave={(r) => void handleSaveRecipe(r)}
          onDelete={() => void handleDeleteRecipe(recipe.id)}
        />
      ))}
    </ScrollView>
  );
}

function RecipeEditorCard(props: {
  recipe: Recipe;
  onSave: (recipe: Recipe) => void;
  onDelete: () => void;
}) {
  const { recipe, onSave, onDelete } = props;
  const [name, setName] = useState(recipe.name);
  const [description, setDescription] = useState(recipe.description || '');
  const [type, setType] = useState(recipe.type);
  const [baseUnit, setBaseUnit] = useState(recipe.baseUnit);
  const [paramsText, setParamsText] = useState(JSON.stringify(recipe.params, null, 2));
  const [outputsText, setOutputsText] = useState(JSON.stringify(recipe.outputs, null, 2));
  const [error, setError] = useState<string | null>(null);

  const handleSave = () => {
    try {
      const params = JSON.parse(paramsText);
      const outputs = JSON.parse(outputsText);
      if (!Array.isArray(params)) {
        throw new Error('params debe ser un arreglo JSON.');
      }
      if (!Array.isArray(outputs)) {
        throw new Error('outputs debe ser un arreglo JSON.');
      }

      onSave({
        ...recipe,
        name: name.trim() || recipe.name,
        description: description.trim() || undefined,
        type,
        baseUnit: baseUnit.trim() || 'unit',
        params,
        outputs,
      });
      setError(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar la receta.');
    }
  };

  return (
    <SectionCard title={recipe.name} subtitle={recipe.id}>
      <Field label="Nombre" value={name} onChangeText={setName} />
      <Field label="Descripción" value={description} onChangeText={setDescription} multiline />
      <View style={styles.row}>
        <View style={styles.flexField}>
          <Field label="Tipo" value={type} onChangeText={(value) => setType(value as Recipe['type'])} />
        </View>
        <View style={styles.flexField}>
          <Field label="Unidad base" value={baseUnit} onChangeText={setBaseUnit} />
        </View>
      </View>
      <Field label="Params JSON" value={paramsText} onChangeText={setParamsText} multiline />
      <Field label="Outputs JSON" value={outputsText} onChangeText={setOutputsText} multiline />
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
    minHeight: 160,
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
