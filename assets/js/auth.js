import { auth } from "./firebase.js";
import {
  getReturnToFromLocation,
  pickDestination,
  safeRedirect,
  validateRoleWithBackend
} from "./role-gateway.js?v=20260213c";
import {
  signInWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence,
  onAuthStateChanged,
  signOut
} from "../vendor/firebase/firebase-auth.js";
import { clearPortalSession } from "./portal-session.js";
import { createLogger } from "./logger.js";

const form = document.getElementById("loginForm");
const errorMsg = document.getElementById("error");
const submitBtn = form?.querySelector("button[type='submit']");
const submitLabel = submitBtn?.textContent || "Login";
let retryBtn = null;
let retryHandler = null;
let manualAuthFlow = false;
const logger = createLogger("login-empleado");

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
  retryBtn.className = "btn-employee";
  retryBtn.textContent = "Reintentar";
  retryBtn.style.marginTop = "10px";
  retryBtn.style.display = "none";
  retryBtn.addEventListener("click", () => {
    if (retryHandler) retryHandler();
  });
  if (errorMsg) errorMsg.insertAdjacentElement("afterend", retryBtn);
  return retryBtn;
}

function setError(msg = "", options = {}) {
  if (errorMsg) errorMsg.textContent = msg || "";
  if (options.retry) {
    const btn = ensureRetryButton();
    btn.style.display = "block";
  } else if (retryBtn) {
    retryBtn.style.display = "none";
  }
}

function niceError(code = "") {
  switch (code) {
    case "auth/invalid-email":
      return "Email invalido.";
    case "auth/missing-password":
      return "Falta la contrasena.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Credenciales incorrectas.";
    case "auth/too-many-requests":
      return "Demasiados intentos. Proba mas tarde.";
    case "auth/unauthorized-domain":
      return "Dominio no autorizado en Firebase. Agrega este dominio en Firebase Console.";
    case "auth/operation-not-allowed":
      return "Proveedor de autenticacion deshabilitado en Firebase.";
    case "auth/network-request-failed":
      return "Error de red al conectar con Firebase.";
    default:
      return "No se pudo iniciar sesion. Revisa tus datos.";
  }
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
      expectedRole: "employee",
      preferTokenRole: true
    });
    if (!result) {
      setError("Tu cuenta no tiene permisos asignados o tu sesion expiro.");
      await clearPortalSession({ revoke: true });
      await signOut(auth);
      return;
    }

    // STRICT CHECK: Only allow Employee
    if (result.role !== "employee") {
      setError("Esta cuenta NO es de empleado. Usa el acceso correcto.");
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
    if (err?.kind === "timeout" || err?.kind === "network") {
      setError("No se pudo conectar con el servidor.", { retry: true });
      return;
    }
    if (err?.kind === "auth" || err?.status === 401) {
      setError("Tu sesion expiro. Inicia sesion nuevamente.");
      await clearPortalSession({ revoke: true });
      await signOut(auth);
      return;
    }
    setError(err?.message || "Error del servidor.", { retry: true });
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
    const password = document.getElementById("password")?.value || "";

    try {
      // Persistencia para que Firebase te reconozca en todas las paginas
      await setPersistence(auth, browserLocalPersistence);

      const cred = await signInWithEmailAndPassword(auth, email, password);
      const user = cred.user;
      const display =
        user.displayName ||
        (user.email ? user.email.split("@")[0] : "Employee");

      localStorage.setItem("employeeName", display);
      await runGatewayFlow("submit");
    } catch (err) {
      logger.error("login error", err);
      setError(niceError(err?.code));
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
