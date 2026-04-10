import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import type { BuilderSnapshot } from '@/src/stores/builderStore';

function buildExportUri() {
  if (!FileSystem.documentDirectory) {
    throw new Error('No hay documentDirectory disponible en este dispositivo.');
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${FileSystem.documentDirectory}electric-builder-${stamp}.json`;
}

export async function exportBuilderSnapshotToFile(snapshot: BuilderSnapshot) {
  const uri = buildExportUri();
  await FileSystem.writeAsStringAsync(uri, JSON.stringify(snapshot, null, 2), {
    encoding: FileSystem.EncodingType.UTF8
  });
  return uri;
}

export async function shareBuilderSnapshotFile(uri: string) {
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error('El sistema no permite compartir archivos en este dispositivo.');
  }

  await Sharing.shareAsync(uri, {
    mimeType: 'application/json',
    dialogTitle: 'Compartir snapshot del builder'
  });
}

export async function pickBuilderSnapshotFile() {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/json', '*/*'],
    copyToCacheDirectory: true,
    multiple: false,
    base64: false
  });

  if (result.canceled || !result.assets?.length) {
    return null;
  }

  const asset = result.assets[0];
  const raw = await FileSystem.readAsStringAsync(asset.uri, {
    encoding: FileSystem.EncodingType.UTF8
  });

  return JSON.parse(raw) as unknown;
}
