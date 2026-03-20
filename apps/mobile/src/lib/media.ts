/**
 * media.ts — Permission requests and image picking.
 *
 * Wraps expo-image-picker so screens never touch the picker API directly.
 * Returns null on cancellation or permission denial; throws on unexpected errors.
 */

import * as ImagePicker from 'expo-image-picker';

import type { PickedImage } from '@/src/types/media';

// ─── Permissions ─────────────────────────────────────────────────────────────

/**
 * Requests read access to the device's media library.
 * Returns true if granted, false otherwise (denied or restricted).
 */
export async function requestLibraryPermission(): Promise<boolean> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return status === 'granted';
}

/**
 * Requests camera access.
 * Returns true if granted, false otherwise.
 */
export async function requestCameraPermission(): Promise<boolean> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  return status === 'granted';
}

// ─── Picking helpers ──────────────────────────────────────────────────────────

function assetToPickedImage(asset: ImagePicker.ImagePickerAsset): PickedImage {
  return {
    uri: asset.uri,
    width: asset.width,
    height: asset.height,
    // expo-image-picker may return undefined on some platforms
    mimeType: asset.mimeType ?? 'image/jpeg',
    fileSize: asset.fileSize ?? null,
    fileName: asset.fileName ?? null,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Opens the device's image gallery.
 * Requests library permission first; returns null if denied or user cancels.
 *
 * quality: 1 — we do our own compression in compressImageForUpload().
 * exif: false — not needed and reduces memory pressure.
 */
export async function pickImageFromLibrary(): Promise<PickedImage | null> {
  const granted = await requestLibraryPermission();
  if (!granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 1,
    exif: false,
  });

  if (result.canceled || result.assets.length === 0) return null;
  return assetToPickedImage(result.assets[0]);
}

/**
 * Opens the device camera and captures a photo.
 * Requests camera permission first; returns null if denied or user cancels.
 */
export async function captureImageFromCamera(): Promise<PickedImage | null> {
  const granted = await requestCameraPermission();
  if (!granted) return null;

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 1,
    exif: false,
  });

  if (result.canceled || result.assets.length === 0) return null;
  return assetToPickedImage(result.assets[0]);
}
