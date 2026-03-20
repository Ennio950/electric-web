import { auth } from "./firebase.js";
import {
  getReturnToFromLocation,
  pickDestination,
  sanitizeReturnTo,
  safeRedirect,
  validateRoleWithBackend
} from "./role-gateway.js?v=20260310c";
import { API_BASE, fetchWithTimeout, DEFAULT_TIMEOUT_MS, getIdTokenForUser } from "./api.js?v=20260310c";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut
} from "../vendor/firebase/firebase-auth.js";
import { clearPortalSession } from "./portal-session.js";
import { createLogger } from "./logger.js";
import { isTemporaryPublicHost } from "./firebase-config.js";

const DEFAULT_RETURN = "panel-cliente.html";
const logger = createLogger("login-gateway");

void clearPortalSession({ revoke: true });

/**
 * Ensures the user profile exists on backend with role=client.
 * Called AFTER Firebase Auth signup/login BEFORE role detection.
 * This guarantees users/{uid} exists with role=client for new users.
 */
async function ensureUserOnBackend(user) {
  if (!user) return;

  const token = await getIdTokenForUser(user, false);
  if (!token) {
    throw new Error("No se pudo obtener el token de Google.");
  }
  const displayName = user.displayName || null;

  try {
    const res = await fetchWithTimeout(
      `${API_BASE}/auth/ensure-user`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ displayName })
      },
      DEFAULT_TIMEOUT_MS
    );

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      logger.warn("ensure-user failed:", res.status, body);
      // Don't throw - proceed with gateway flow anyway
      // The role detection will fail more gracefully
    } else {
      const body = await res.json();
      logger.debug("ensure-user ok:", body);
    }
  } catch (err) {
    logger.warn("ensure-user error:", err);
    // Don't block login flow, role detection will handle errors
  }
}

// UI refs
const form = document.getElementById("auth-form");
const emailInput = document.getElementById("email");
const passInput = document.getElementById("password");
const confirmPassInput = document.getElementById("confirm-password");
const confirmContainer = document.getElementById("confirm-pass-container");
const submitBtn = document.getElementById("submit-btn");
const btnText = document.getElementById("btn-text");
const spinner = document.getElementById("spinner");
const errorMsg = document.getElementById("error-msg");
const toggleModeBtn = document.getElementById("toggle-mode-btn");
const toggleText = document.getElementById("toggle-text");
const pageSubtitle = document.getElementById("page-subtitle");
const togglePassBtn = document.getElementById("toggle-pass");
const googleBtn = document.getElementById("google-btn");
const googleDomainHelp = document.getElementById("google-domain-help");

let isRegisterMode = false;
let retryBtn = null;
let retryHandler = null;
let manualAuthFlow = false;
let redirectAuthInFlight = false;

function setLoading(isLoading) {
  if (googleBtn) {
    googleBtn.disabled = isLoading;
    googleBtn.classList.toggle("opacity-75", isLoading);
  }
  submitBtn.disabled = isLoading;
  if (isLoading) {
    submitBtn.classList.add("opacity-75", "cursor-not-allowed");
    btnText.textContent = isRegisterMode ? "CREANDO..." : "INICIANDO...";
    spinner.classList.remove("hidden");
    clearError();
  } else {
    submitBtn.classList.remove("opacity-75", "cursor-not-allowed");
    btnText.textContent = isRegisterMode ? "CREAR CUENTA" : "INICIAR SESION";
    spinner.classList.add("hidden");
  }
}

function clearError() {
  errorMsg.classList.add("hidden");
  errorMsg.innerHTML = "";
  if (retryBtn) retryBtn.classList.add("hidden");
}

function ensureRetryButton() {
  if (retryBtn) return retryBtn;
  retryBtn = document.createElement("button");
  retryBtn.type = "button";
  retryBtn.className =
    "mt-3 inline-flex items-center justify-center rounded-md bg-red-800/60 px-3 py-2 text-xs font-semibold text-red-100 hover:bg-red-800";
  retryBtn.textContent = "Reintentar";
  retryBtn.addEventListener("click", () => {
    if (retryHandler) retryHandler();
  });
  return retryBtn;
}

function showError(msg, options = {}) {
  errorMsg.innerHTML = "";
  errorMsg.appendChild(document.createTextNode(msg));

  if (options.retry) {
    const btn = ensureRetryButton();
    btn.classList.remove("hidden");
    errorMsg.appendChild(document.createElement("br"));
    errorMsg.appendChild(btn);
  } else if (retryBtn) {
    retryBtn.classList.add("hidden");
  }

  errorMsg.classList.remove("hidden");
}

function isLocalHost(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function renderGoogleDomainHelp() {
  if (!googleDomainHelp) return;

  const currentHost = String(window.location.hostname || "").trim();
  const authDomain = String(auth?.app?.options?.authDomain || "").trim();
  const isPublicHost = currentHost && !isLocalHost(currentHost);

  if (!isPublicHost || !authDomain || currentHost === authDomain) {
    googleDomainHelp.textContent = "";
    googleDomainHelp.classList.add("hidden");
    return;
  }

  if (isTemporaryPublicHost(currentHost)) {
    googleDomainHelp.textContent =
      `Host temporal detectado: ${currentHost}. Google usara el dominio administrado de Firebase para evitar bloqueos del redirect URI en tuneles publicos.`;
  } else {
    googleDomainHelp.textContent =
      `Host actual: ${currentHost}. Para Google en este dominio, agregalo en Firebase Authentication > Settings > Authorized domains y configura su redirect URI en Google Cloud OAuth si usas authDomain propio.`;
  }

  googleDomainHelp.classList.remove("hidden");
}

function handleFirebaseError(error) {
  logger.error("auth error", error);
  let msg = "Error inesperado. Intenta nuevamente.";
  switch (error?.code) {
    case "auth/invalid-credential":
    case "auth/user-not-found":
    case "auth/wrong-password":
      msg = "Credenciales incorrectas.";
      break;
    case "auth/email-already-in-use":
      msg = "Este correo ya esta registrado.";
      break;
    case "auth/weak-password":
      msg = "La contrasena es muy debil (minimo 6).";
      break;
    case "auth/unauthorized-domain":
      msg = `Google no esta autorizado para ${window.location.hostname}. Agrega este dominio en Firebase Console > Authentication > Settings > Authorized domains.`;
      break;
    case "auth/operation-not-allowed":
      msg = "Proveedor de autenticacion deshabilitado en Firebase.";
      break;
    case "auth/operation-not-supported-in-this-environment":
      msg = "Este navegador no permite popup de Google. Usa el flujo por redireccion.";
      break;
    case "auth/network-request-failed":
      msg = "Error de red al conectar con Firebase. Si estas en un dominio publico, revisa tambien la configuracion de Google/Firebase para este host.";
      break;
    case "auth/popup-closed-by-user":
      msg = "Popup cerrado. Intenta nuevamente o usa redireccion.";
      break;
    case "auth/popup-blocked":
      msg = "El popup fue bloqueado por el navegador.";
      break;
    case "auth/cancelled-popup-request":
      msg = "Se cancelo la solicitud popup anterior. Intenta de nuevo.";
      break;
  }
  showError(msg);
}

function createGoogleProvider() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return provider;
}

function isLikelyMobile() {
  const ua = navigator.userAgent || "";
  return /android|iphone|ipad|ipod|iemobile|mobile/i.test(ua) || window.matchMedia("(max-width: 900px)").matches;
}

function shouldFallbackToRedirect(error) {
  const code = String(error?.code || "");
  return [
    "auth/popup-blocked",
    "auth/popup-closed-by-user",
    "auth/cancelled-popup-request",
    "auth/operation-not-supported-in-this-environment",
  ].includes(code);
}

async function finishClientAuth(source, user) {
  if (user) localStorage.setItem("clientName", user.displayName || user.email || "");
  await ensureUserOnBackend(user);
  await runGatewayFlow(source);
}

async function handleGoogleRedirectResult() {
  redirectAuthInFlight = true;
  let handledRedirectUser = false;
  try {
    const result = await getRedirectResult(auth);
    if (!result?.user) return;
    handledRedirectUser = true;
    manualAuthFlow = true;
    setLoading(true);
    clearError();
    await finishClientAuth("google-redirect", result.user);
  } catch (error) {
    handleFirebaseError(error);
    setLoading(false);
  } finally {
    manualAuthFlow = false;
    redirectAuthInFlight = false;
    // If there was an existing session but no redirect payload, continue normal gateway flow.
    if (!handledRedirectUser && auth.currentUser && !manualAuthFlow) {
      ensureUserOnBackend(auth.currentUser).then(() => runGatewayFlow("postRedirectCheck"));
    }
  }
}

function ensureFirebaseReady() {
  try {
    if (!auth?.app?.options?.projectId) {
      throw new Error("Firebase no esta configurado: falta projectId.");
    }
    logger.info("Firebase OK: projectId=", auth.app.options.projectId);
    renderGoogleDomainHelp();
  } catch (e) {
    logger.error("Firebase init error:", e);
    showError("Firebase no esta configurado. Revisa assets/js/firebase.js");
    throw e;
  }
}

async function runGatewayFlow(source = "manual") {
  const user = auth.currentUser;
  if (!user) return;
  if (window.__gwNavigating) return;
  window.__gwNavigating = true;

  const rawReturnTo = getReturnToFromLocation() || DEFAULT_RETURN;
  const safeReturnTo = sanitizeReturnTo(rawReturnTo);
  logger.debug("url", window.location.href, "returnTo", rawReturnTo, "safeReturnTo", safeReturnTo);
  logger.debug("user.uid", user.uid);

  retryHandler = () => runGatewayFlow("retry");
  setLoading(true);

  try {
    const result = await validateRoleWithBackend(user, {
      debugLabel: "[gateway]",
      expectedRole: "client",
      preferTokenRole: true
    });
    if (!result) {
      showError("Tu cuenta no tiene permisos asignados o tu sesion expiro.");
      await clearPortalSession({ revoke: true });
      await signOut(auth);
      return;
    }

    // STRICT CHECK: Only allow Client
    if (result.role !== "client") {
      showError("Esta cuenta NO es de cliente. Usa el acceso correcto.");
      await clearPortalSession({ revoke: true });
      await signOut(auth);
      return;
    }

    const dest = pickDestination(result.role, safeReturnTo);
    if (!safeRedirect(dest)) {
      logger.debug("already at destination", dest);
    }
  } catch (err) {
    logger.error("gateway error", err);
    if (err?.kind === "timeout" || err?.kind === "network") {
      showError("No se pudo conectar con el servidor.", { retry: true });
      return;
    }
    if (err?.kind === "auth" || err?.status === 401) {
      showError("Tu sesion expiro. Inicia sesion nuevamente.");
      await clearPortalSession({ revoke: true });
      await signOut(auth);
      return;
    }
    showError(err?.message || "Error del servidor.", { retry: true });
  } finally {
    setLoading(false);
    window.__gwNavigating = false;
  }
}

function toggleMode() {
  isRegisterMode = !isRegisterMode;
  if (isRegisterMode) {
    confirmContainer.classList.remove("hidden");
    confirmPassInput.setAttribute("required", "true");
    btnText.textContent = "CREAR CUENTA";
    toggleText.textContent = "¿Ya tienes cuenta?";
    toggleModeBtn.textContent = "Iniciar Sesion";
    pageSubtitle.textContent = "Crea una cuenta para comenzar";
  } else {
    confirmContainer.classList.add("hidden");
    confirmPassInput.removeAttribute("required");
    btnText.textContent = "INICIAR SESION";
    toggleText.textContent = "¿No tienes cuenta?";
    toggleModeBtn.textContent = "Crear Cuenta";
    pageSubtitle.textContent = "Ingresa para gestionar tus servicios";
  }
  clearError();
}

function wireEvents() {
  toggleModeBtn.addEventListener("click", toggleMode);

  togglePassBtn.addEventListener("click", () => {
    const type = passInput.getAttribute("type") === "password" ? "text" : "password";
    passInput.setAttribute("type", type);
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    ensureFirebaseReady();
    const email = emailInput.value.trim();
    const password = passInput.value;

    if (isRegisterMode) {
      if (password !== confirmPassInput.value) return showError("Las contrasenas no coinciden.");
      if (password.length < 6) return showError("La contrasena debe tener al menos 6 caracteres.");
    }

    setLoading(true);
    clearError();
    manualAuthFlow = true;
    try {
      if (isRegisterMode) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      const user = auth.currentUser;
      if (user) localStorage.setItem("clientName", user.displayName || user.email || "");
      await ensureUserOnBackend(user);
      await runGatewayFlow("submit");
    } catch (error) {
      handleFirebaseError(error);
      setLoading(false);
    } finally {
      manualAuthFlow = false;
    }
  });

  googleBtn.addEventListener("click", async () => {
    ensureFirebaseReady();
    setLoading(true);
    clearError();
    manualAuthFlow = true;
    const provider = createGoogleProvider();
    try {
      if (isLikelyMobile()) {
        redirectAuthInFlight = true;
        await signInWithRedirect(auth, provider);
        return;
      }

      try {
        await signInWithPopup(auth, provider);
      } catch (popupError) {
        if (shouldFallbackToRedirect(popupError)) {
          redirectAuthInFlight = true;
          await signInWithRedirect(auth, provider);
          return;
        }
        throw popupError;
      }

      const user = auth.currentUser;
      await finishClientAuth("google", user);
    } catch (error) {
      handleFirebaseError(error);
      setLoading(false);
    } finally {
      manualAuthFlow = false;
    }
  });
}

ensureFirebaseReady();
wireEvents();
void handleGoogleRedirectResult();

// Auto redirect if already logged in
onAuthStateChanged(auth, (user) => {
  logger.debug("onAuthStateChanged", user?.uid || null);
  if (user && !manualAuthFlow && !redirectAuthInFlight) {
    ensureUserOnBackend(user).then(() => runGatewayFlow("onAuthStateChanged"));
  }
});
