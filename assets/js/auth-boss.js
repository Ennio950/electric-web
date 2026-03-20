import { auth } from "./firebase.js";
import {
  getReturnToFromLocation,
  pickDestination,
  safeRedirect,
  validateRoleWithBackend
} from "./role-gateway.js?v=20260213c";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "../vendor/firebase/firebase-auth.js";
import { clearPortalSession } from "./portal-session.js";
import { createLogger } from "./logger.js";

const form = document.getElementById("bossLoginForm");
const errBox = document.getElementById("error");
const submitBtn = form?.querySelector("button[type='submit']");
const submitLabel = submitBtn?.textContent || "Entrar";
let retryBtn = null;
let retryHandler = null;
let manualAuthFlow = false;
const logger = createLogger("login-jefe");

void clearPortalSession({ revoke: true });

function setLoading(isLoading) {
  if (!submitBtn) return;
  submitBtn.disabled = isLoading;
  submitBtn.textContent = isLoading ? "INICIANDO..." : submitLabel;
}

function ensureRetryButton() {
  if (retryBtn) return retryBtn;
  retryBtn = document.createElement("button");
  retryBtn.type = "button";
  retryBtn.className = "btn-boss";
  retryBtn.textContent = "Reintentar";
  retryBtn.style.marginTop = "10px";
  retryBtn.style.display = "none";
  retryBtn.addEventListener("click", () => {
    if (retryHandler) retryHandler();
  });
  if (errBox) errBox.insertAdjacentElement("afterend", retryBtn);
  return retryBtn;
}

function setError(msg = "", options = {}) {
  if (errBox) errBox.textContent = msg || "";
  if (options.retry) {
    const btn = ensureRetryButton();
    btn.style.display = "block";
  } else if (retryBtn) {
    retryBtn.style.display = "none";
  }
}

function niceError(err) {
  switch (err?.code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Credenciales incorrectas.";
    case "auth/unauthorized-domain":
      return "Dominio no autorizado en Firebase. Agrega este dominio en Firebase Console.";
    case "auth/operation-not-allowed":
      return "Proveedor de autenticacion deshabilitado en Firebase.";
    case "auth/network-request-failed":
      return "Error de red al conectar con Firebase.";
    default:
      return err?.message || "Error iniciando sesion.";
  }
}

function niceGatewayError(err) {
  if (!err) return "Error del servidor.";
  if (err.kind === "timeout") return "El servidor tardo demasiado en responder.";
  if (err.kind === "network") return "No se pudo conectar al servidor.";
  if (err.kind === "auth" || err.status === 401) return "Tu sesion expiro. Inicia sesion nuevamente.";
  if (err.status === 403) return "Esta cuenta no tiene permisos de Jefe.";
  if (err.status === 404) return "Servidor API no disponible (ruta no encontrada).";
  return err.message || "Error del servidor.";
}

async function runGatewayFlow(source = "manual") {
  const user = auth.currentUser;
  if (!user) return;
  if (window.__gwNavigating) return;
  window.__gwNavigating = true;

  const rawReturnTo = getReturnToFromLocation();
  logger.debug("url", window.location.href, "returnTo", rawReturnTo);
  logger.debug("user.uid", user.uid);

  retryHandler = () => runGatewayFlow("retry");
  setError("");
  setLoading(true);

  try {
    const result = await validateRoleWithBackend(user, {
      debugLabel: "[gateway]",
      expectedRole: "boss",
      preferTokenRole: true
    });
    if (!result) {
      setError("Tu cuenta no tiene permisos asignados o tu sesion expiro.");
      await clearPortalSession({ revoke: true });
      await signOut(auth);
      return;
    }

    // STRICT CHECK: Only allow Boss
    if (result.role !== "boss") {
      setError("Esta cuenta NO tiene permisos de Jefe.");
      await clearPortalSession({ revoke: true });
      await signOut(auth);
      return;
    }

    const dest = pickDestination(result.role, rawReturnTo);
    if (!safeRedirect(dest)) {
      logger.debug("already at destination", dest);
    }
  } catch (err) {
    logger.error("gateway error", err);
    if (err?.kind === "auth" || err?.status === 401) {
      setError("Tu sesion expiro. Inicia sesion nuevamente.");
      await clearPortalSession({ revoke: true });
      await signOut(auth);
      return;
    }
    setError(niceGatewayError(err), { retry: true });
  } finally {
    setLoading(false);
    window.__gwNavigating = false;
  }
}

if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    manualAuthFlow = true;

    const email = (document.getElementById("email")?.value || "").trim();
    const password = (document.getElementById("password")?.value || "").trim();

    try {
      await signInWithEmailAndPassword(auth, email, password);
      await runGatewayFlow("submit");
    } catch (ex) {
      logger.error("boss login error", ex);
      setError(niceError(ex));
      setLoading(false);
    } finally {
      manualAuthFlow = false;
    }
  });
}

onAuthStateChanged(auth, (user) => {
  logger.debug("onAuthStateChanged", user?.uid || null);
  if (user && !manualAuthFlow) runGatewayFlow("onAuthStateChanged");
});
