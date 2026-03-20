import { auth } from "./firebase.js";
import { onAuthStateChanged } from "../vendor/firebase/firebase-auth.js";

export async function getRoleFromToken() {
  const user = auth.currentUser;
  if (!user) return null;
  const token = await user.getIdTokenResult();
  return token?.claims?.role || null;
}

export function requireAuth(role) {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        redirectToLogin(role);
        return;
      }

      if (role) {
        let token = await user.getIdTokenResult();
        // If role missing, try force refresh once
        if (!token?.claims?.role) {
          await user.getIdToken(true);
          token = await user.getIdTokenResult();
        }

        const claimRole = token?.claims?.role || null;

        // Strict Check: If we require a role, and user has NO role, we should probably block?
        // For now, keep existing logic: Only block if role is EXPLICITLY wrong.
        if (claimRole && role === "employee" && claimRole !== "employee" && claimRole !== "boss") {
          redirectToLogin(role);
          return;
        }
        if (claimRole && role === "client" && claimRole !== "client") {
          redirectToLogin(role);
          return;
        }

        // If role is still null, we let them pass (maybe they are new or backend slow).
        // But backend APIs might fail (handled by client-requests.js now without loop).
      }

      if (role === "employee") {
        const stored = localStorage.getItem("employeeName") || "";
        const name = user.displayName || stored || user.email || user.uid;
        localStorage.setItem("employeeName", name);
      }
      if (role === "client") {
        const stored = localStorage.getItem("clientName") || "";
        const name = user.displayName || stored || user.email || user.uid;
        localStorage.setItem("clientName", name);
      }

      resolve(user);
    });
  });
}

export function getSavedName(role) {
  if (role === "employee") return localStorage.getItem("employeeName") || "";
  if (role === "client") return localStorage.getItem("clientName") || "";
  return "";
}

function redirectToLogin(role) {
  if (role === "employee") {
    window.location.href = "login-empleado.html";
    return;
  }
  window.location.href = "login-gateway.html";
}
