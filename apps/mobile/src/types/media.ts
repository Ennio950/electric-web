/**
 * A raw image asset returned by the picker (gallery or camera).
 * fileSize may be null if the OS didn't report it.
 */
export type PickedImage = {
  uri: string;
  width: number;
  height: number;
  /** Original MIME type reported by the picker, e.g. 'image/jpeg' */
  mimeType: string;
  fileSize: number | null;
  fileName: string | null;
};

/**
 * An image that has been resized/compressed and is ready to upload.
 * fileSize is not available post-compression (expo-image-manipulator
 * does not expose it after saving to a temp URI).
 */
export type CompressedImage = {
  uri: string;
  width: number;
  height: number;
  mimeType: 'image/jpeg' | 'image/png';
};

/**
 * Successful response from POST /api/uploads/image.
 */
export type UploadImageResult = {
  ok: true;
  url: string;
  publicId: string;
  width: number;
  height: number;
};
