/**
 * imageUpload.ts — Compression and upload to /api/uploads/image.
 *
 * Pipeline:
 *   PickedImage
 *     → compressImageForUpload()  (resize + quality reduction)
 *     → CompressedImage
 *     → uploadImageAsset()        (multipart POST with Bearer token)
 *     → UploadImageResult
 */

import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

import { buildApiUrl } from '@/src/config/mobileEnv';
import type { MobilePhotoPolicy } from '@/src/types/api';
import type { CompressedImage, PickedImage, UploadImageResult } from '@/src/types/media';

// ─── Errors ───────────────────────────────────────────────────────────────────

export class UploadError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'UploadError';
    this.status = status;
  }
}

export class PhotoPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PhotoPolicyError';
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

type OutputFormat = {
  format: SaveFormat;
  mimeType: 'image/jpeg' | 'image/png';
};

/**
 * Picks the output format from the policy's allowedMimeTypes.
 * Prefers JPEG (lossy compression is effective); falls back to PNG.
 */
function resolveOutputFormat(allowedMimeTypes: string[]): OutputFormat {
  if (allowedMimeTypes.includes('image/jpeg')) {
    return { format: SaveFormat.JPEG, mimeType: 'image/jpeg' };
  }
  if (allowedMimeTypes.includes('image/png')) {
    return { format: SaveFormat.PNG, mimeType: 'image/png' };
  }
  // Policy is misconfigured or empty — default to JPEG.
  return { format: SaveFormat.JPEG, mimeType: 'image/jpeg' };
}

/**
 * Returns the resize target if the image exceeds maxDimension on either axis,
 * maintaining aspect ratio. Returns null if no resize is needed.
 */
function computeResize(
  width: number,
  height: number,
  maxDimension: number,
): { width: number; height: number } | null {
  const longest = Math.max(width, height);
  if (longest <= maxDimension) return null;
  const scale = maxDimension / longest;
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}

/**
 * Estimates the JPEG quality (0–1) needed to approach compressionTargetBytes.
 *
 * When fileSize is unknown we assume the image is large and apply moderate
 * compression (0.82). PNG ignores this value (lossless), so callers should
 * not rely on it for PNG targets.
 */
function estimateQuality(fileSize: number | null, compressionTargetBytes: number): number {
  if (fileSize == null) return 0.82;
  if (fileSize <= compressionTargetBytes) return 0.92; // already fits — light touch
  const ratio = compressionTargetBytes / fileSize;
  // Keep within a visually acceptable range.
  return Math.max(0.1, Math.min(0.92, ratio));
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Resizes and compresses a picked image to fit within the constraints in
 * photoPolicy (maxImageDimension + compressionTargetBytes).
 *
 * Throws PhotoPolicyError if the MIME type is not in allowedMimeTypes.
 *
 * Note: The resulting CompressedImage does not expose a fileSize because
 * expo-image-manipulator writes to a temp URI without returning byte count.
 * If the backend enforces maxUploadBytes strictly, oversized images will be
 * rejected at upload time with an UploadError.
 */
export async function compressImageForUpload(
  asset: PickedImage,
  photoPolicy: MobilePhotoPolicy,
): Promise<CompressedImage> {
  const { maxImageDimension, compressionTargetBytes, allowedMimeTypes, maxUploadBytes } = photoPolicy;

  // Reject unsupported MIME types before doing any heavy work.
  if (!allowedMimeTypes.includes(asset.mimeType as MobilePhotoPolicy['allowedMimeTypes'][number])) {
    throw new PhotoPolicyError(
      `Tipo de imagen no permitido: "${asset.mimeType}". Aceptados: ${allowedMimeTypes.join(', ')}.`,
    );
  }

  // Warn early if the original file is already over the hard limit.
  // We still attempt compression; the backend is the final gatekeeper.
  if (asset.fileSize != null && asset.fileSize > maxUploadBytes) {
    console.warn(
      `[imageUpload] El archivo original (${asset.fileSize} bytes) supera maxUploadBytes (${maxUploadBytes}). ` +
        'Se intentará comprimir de todas formas.',
    );
  }

  const { format, mimeType } = resolveOutputFormat(allowedMimeTypes);
  const resize = computeResize(asset.width, asset.height, maxImageDimension);
  // PNG is lossless — quality has no effect, but we pass it for API compatibility.
  const quality = mimeType === 'image/png' ? 1 : estimateQuality(asset.fileSize, compressionTargetBytes);

  const actions = resize ? [{ resize: { width: resize.width, height: resize.height } }] : [];

  const result = await manipulateAsync(asset.uri, actions, {
    compress: quality,
    format,
    base64: false,
  });

  return {
    uri: result.uri,
    width: result.width,
    height: result.height,
    mimeType,
  };
}

/**
 * Uploads an image (picked or compressed) to POST /api/uploads/image.
 *
 * Sends multipart/form-data with field name "image" as required by the backend.
 * The Content-Type header is intentionally omitted so that fetch injects the
 * correct multipart boundary automatically.
 *
 * Throws UploadError on non-2xx responses.
 */
export async function uploadImageAsset({
  token,
  asset,
}: {
  token: string;
  asset: PickedImage | CompressedImage;
}): Promise<UploadImageResult> {
  const mimeType = asset.mimeType ?? 'image/jpeg';
  const ext = mimeType === 'image/png' ? 'png' : 'jpg';
  const fileName = `upload_${Date.now()}.${ext}`;

  // React Native's FormData.append accepts a plain object with {uri, name, type}
  // at runtime even though TypeScript types only declare Blob | string.
  const formData = new FormData();
  formData.append('image', {
    uri: asset.uri,
    name: fileName,
    type: mimeType,
  } as unknown as Blob);

  const url = buildApiUrl('/api/uploads/image');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      // No Content-Type — fetch sets it with the correct multipart boundary.
    },
    body: formData,
  });

  const payload: unknown = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      payload !== null &&
      typeof payload === 'object' &&
      'message' in payload &&
      typeof (payload as Record<string, unknown>).message === 'string'
        ? (payload as { message: string }).message
        : `Upload falló con status ${response.status}.`;
    throw new UploadError(response.status, message);
  }

  return payload as UploadImageResult;
}
