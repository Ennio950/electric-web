import { initializeApp } from "../vendor/firebase/firebase-app.js";
import { getAuth, setPersistence, browserLocalPersistence, onAuthStateChanged } from "../vendor/firebase/firebase-auth.js";
import { getFirestore } from "../vendor/firebase/firebase-firestore.js";
import { createLogger } from "./logger.js";
import { DEFAULT_FIREBASE_AUTH_DOMAIN, resolveFirebaseAuthDomain } from "./firebase-config.js";

const logger = createLogger("firebase");

// Pega aquí tu configuración de Firebase Web (Firebase console → Project settings → SDK setup)
// Los valores actuales corresponden al proyecto Straight Wire Electric.
const firebaseConfig = {
  apiKey: "AIzaSyDIlxPHbQnuQpKy0S9SOuiXxla7r6LE6WA",
  authDomain: resolveFirebaseAuthDomain(window.location, DEFAULT_FIREBASE_AUTH_DOMAIN),
  projectId: "straight-wire-electric",
  storageBucket: "straight-wire-electric.firebasestorage.app",
  messagingSenderId: "989475635196",
  appId: "1:989475635196:web:3eb3eed7d653356178bc79"
};

function validateConfig(cfg) {
  const required = ["apiKey", "authDomain", "projectId", "appId"];
  const missing = required.filter((k) => !cfg?.[k]);
  if (missing.length) {
    const msg = `Config incompleta. Faltan: ${missing.join(", ")}`;
    logger.error(msg);
    throw new Error(msg);
  }
}

let app;
try {
  validateConfig(firebaseConfig);
  app = initializeApp(firebaseConfig);
  logger.info("Firebase OK: projectId=", app.options.projectId, "authDomain=", app.options.authDomain);
} catch (err) {
  logger.error("Error inicializando Firebase:", err);
  throw err;
}

const auth = getAuth(app);
// Force Local Persistence (Ultrafino)
setPersistence(auth, browserLocalPersistence)
  .then(() => logger.debug("Persistencia local habilitada"))
  .catch((e) => logger.warn("Error setting persistence", e));

// Firestore enabled for boss panel realtime updates
const db = getFirestore(app);

export { app, auth, db, onAuthStateChanged };
