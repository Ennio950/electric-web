import { auth } from "./firebase.js";
import { onAuthStateChanged } from "../vendor/firebase/firebase-auth.js";
import { initializeRuntimeConfig } from "./runtime-config.js";

export const DEFAULT_TIMEOUT_MS = 10000;

export const API_BASE = initializeRuntimeConfig(window);
const AUTH_WAIT_TIMEOUT_MS = 2500;
const TOKEN_WAIT_TIMEOUT_MS = 8000;
const MAX_UPLOAD_IMAGE_BYTES = 15 * 1024 * 1024;
const COMPRESSION_TRIGGER_BYTES = 3 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 2560;
const COMPRESSION_SCALE_STEPS = [1, 0.9, 0.8, 0.7];
const COMPRESSION_QUALITY_STEPS = [0.92, 0.86, 0.8, 0.74, 0.68, 0.6];

export async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err?.name === "AbortError") {
      const out = new Error("Request timeout");
      out.kind = "timeout";
      throw out;
    }
    if (err instanceof TypeError) {
      const out = new Error("Network error");
      out.kind = "network";
      throw out;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function waitForAuthenticatedUser(timeoutMs = AUTH_WAIT_TIMEOUT_MS) {
  if (auth.currentUser) {
    return Promise.resolve(auth.currentUser);
  }

  return new Promise((resolve) => {
    let resolved = false;
    let unsubscribe = null;
    const timer = window.setTimeout(() => {
      if (resolved) return;
      resolved = true;
      if (typeof unsubscribe === "function") unsubscribe();
      resolve(auth.currentUser || null);
    }, timeoutMs);

    unsubscribe = onAuthStateChanged(auth, (user) => {
      if (resolved || !user) return;
      resolved = true;
      window.clearTimeout(timer);
      if (typeof unsubscribe === "function") unsubscribe();
      resolve(user);
    });
  });
}

export async function getIdToken(forceRefresh = true) {
  const user = auth.currentUser || await waitForAuthenticatedUser();
  return getIdTokenForUser(user, forceRefresh);
}

function withTimeout(promise, timeoutMs, errorMessage) {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(errorMessage));
    }, timeoutMs);

    Promise.resolve(promise)
      .then((value) => {
        window.clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        window.clearTimeout(timer);
        reject(error);
      });
  });
}

export async function getIdTokenForUser(user, forceRefresh = true) {
  if (!user) return null;

  async function attemptGetToken(shouldRefresh) {
    return withTimeout(
      user.getIdToken(shouldRefresh),
      TOKEN_WAIT_TIMEOUT_MS,
      shouldRefresh ? "Token refresh timeout" : "Token read timeout",
    );
  }

  try {
    return await attemptGetToken(forceRefresh);
  } catch (err) {
    console.warn("[api] Failed to get token:", err);
    if (!forceRefresh) return null;
  }

  try {
    return await attemptGetToken(false);
  } catch (fallbackError) {
    console.warn("[api] Failed to get cached token:", fallbackError);
    return null;
  }
}

function buildUploadError(body, status) {
  const rawCode = String(body?.error || body?.code || "").trim().toLowerCase();
  let message = body?.message || body?.error || `Error ${status}`;

  if (status === 401 || rawCode === "unauthorized" || rawCode === "invalid_token") {
    message = "Tu sesion expiro o Firebase no valido tu acceso. Vuelve a iniciar sesion antes de subir imagenes.";
  } else if (status === 403) {
    message = "No tienes permisos para subir imagenes con esta cuenta.";
  } else if (rawCode === "cloudinary_not_configured") {
    message = "La subida de imagenes no esta disponible todavia. Falta configurar Cloudinary en el backend.";
  } else if (rawCode === "file_too_large") {
    message = "La imagen es demasiado pesada. Usa una menor a 15MB.";
  } else if (rawCode === "invalid_file") {
    message = "Formato no permitido. Usa JPEG, PNG o WebP.";
  } else if (status >= 500) {
    message = "No se pudo subir la imagen en este momento. Revisa la configuracion del backend e intenta de nuevo.";
  }

  const error = new Error(message);
  error.status = status;
  error.body = body;
  error.code = rawCode || undefined;
  return error;
}

export async function apiFetch(path, options = {}) {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...fetchOptions } = options;

  // 2. Prepare Headers
  const headers = new Headers(fetchOptions.headers || {});
  const isFormData = fetchOptions.body instanceof FormData;

  if (!isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  // 3. Auth Logic
  // If caller already provided Authorization, trust it.
  if (!headers.has("Authorization")) {
    const token = await getIdToken(false);
    if (token && typeof token === "string" && token.trim().length > 0 && token !== "null" && token !== "undefined") {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  const res = await fetchWithTimeout(
    `${API_BASE}${path}`,
    {
      ...fetchOptions,
      headers
    },
    timeoutMs
  );

  const isJson = (res.headers.get("content-type") || "").includes("application/json");
  const body = isJson ? await res.json().catch(() => null) : await res.text().catch(() => "");

  if (!res.ok) {
    if (res.status === 500) console.error("API 500 Body:", body);

    // 401/403 handling could be done here globally if desired, but user asked for specific UI handling.
    // We stick to throwing error with properties.
    const msg = body?.message || body?.error || body || `Error ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.body = body;
    throw err;
  }

  return body;
}

function getUploadFileExtension(type = "") {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

function buildUploadFileName(originalName = "image", type = "image/jpeg") {
  const extension = getUploadFileExtension(type);
  const baseName = String(originalName || "image").replace(/\.[^.]+$/, "").trim() || "image";
  return `${baseName}.${extension}`;
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("No se pudo procesar la imagen seleccionada"));
    };

    image.src = objectUrl;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("No se pudo comprimir la imagen"));
    }, type, quality);
  });
}

function getCompressionMimeType(file) {
  return file.type === "image/png" ? "image/webp" : (file.type === "image/webp" ? "image/webp" : "image/jpeg");
}

async function compressImageForUpload(file, options = {}) {
  const maxBytes = options.maxBytes || MAX_UPLOAD_IMAGE_BYTES;
  const triggerBytes = options.triggerBytes || COMPRESSION_TRIGGER_BYTES;
  const maxDimension = options.maxDimension || MAX_IMAGE_DIMENSION;
  const image = await loadImageFromFile(file);
  const longestSide = Math.max(image.naturalWidth || 0, image.naturalHeight || 0);
  const baseScale = longestSide > maxDimension ? maxDimension / longestSide : 1;

  if (file.size <= maxBytes && file.size <= triggerBytes && baseScale >= 1) {
    return file;
  }

  const mimeType = getCompressionMimeType(file);
  let bestCandidate = file;

  for (const scaleStep of COMPRESSION_SCALE_STEPS) {
    const finalScale = Math.min(1, baseScale * scaleStep);
    const width = Math.max(1, Math.round((image.naturalWidth || image.width || 1) * finalScale));
    const height = Math.max(1, Math.round((image.naturalHeight || image.height || 1) * finalScale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d", { alpha: true });
    if (!context) throw new Error("No se pudo inicializar la compresion de imagen");

    context.clearRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    for (const quality of COMPRESSION_QUALITY_STEPS) {
      const blob = await canvasToBlob(canvas, mimeType, quality);
      const candidate = new File(
        [blob],
        buildUploadFileName(file.name, mimeType),
        {
          type: mimeType,
          lastModified: Date.now(),
        }
      );

      if (candidate.size < bestCandidate.size) {
        bestCandidate = candidate;
      }

      if (candidate.size <= maxBytes) {
        return candidate;
      }
    }
  }

  if (bestCandidate.size <= maxBytes) {
    return bestCandidate;
  }

  if (file.size <= maxBytes) {
    return file;
  }

  const err = new Error("No se pudo reducir la imagen por debajo de 15MB");
  err.status = 400;
  throw err;
}

/**
 * Upload an image file to the backend.
 * @param {File} file - The image file to upload
 * @returns {Promise<{ok: boolean, url: string, publicId: string, width: number, height: number}>}
 */
export async function uploadImage(file) {
  if (!file) {
    const err = new Error("No se proporcionó ningún archivo");
    err.status = 400;
    throw err;
  }

  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
  if (!allowedTypes.includes(file.type)) {
    const err = new Error("Tipo de archivo no permitido. Solo: JPEG, PNG, WebP");
    err.status = 400;
    throw err;
  }

  const preparedFile = await compressImageForUpload(file, {
    maxBytes: MAX_UPLOAD_IMAGE_BYTES,
    triggerBytes: COMPRESSION_TRIGGER_BYTES,
    maxDimension: MAX_IMAGE_DIMENSION,
  });

  if (preparedFile.size > MAX_UPLOAD_IMAGE_BYTES) {
    const err = new Error("El archivo excede el límite de 15MB");
    err.status = 400;
    throw err;
  }

  const token = await getIdToken(true);
  if (!token) {
    const err = new Error("Tu sesion aun no esta lista para subir imagenes. Inicia sesion nuevamente e intenta de nuevo.");
    err.status = 401;
    err.code = "missing_token";
    throw err;
  }

  const formData = new FormData();
  formData.append("image", preparedFile);

  const res = await fetchWithTimeout(
    `${API_BASE}/api/uploads/image`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        // Don't set Content-Type - browser will set it with boundary for FormData
      },
      body: formData,
    },
    30000 // 30 second timeout for uploads
  );

  const isJson = (res.headers.get("content-type") || "").includes("application/json");
  const body = isJson ? await res.json().catch(() => null) : await res.text().catch(() => "");

  if (!res.ok) {
    throw buildUploadError(body, res.status);
  }

  return body;
}
