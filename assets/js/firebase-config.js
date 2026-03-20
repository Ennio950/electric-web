const DEFAULT_FIREBASE_AUTH_DOMAIN = "straight-wire-electric.firebaseapp.com";
const TEMPORARY_PUBLIC_HOST_SUFFIXES = [
  ".ngrok-free.dev",
  ".ngrok.app",
  ".loca.lt",
];

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeHost(value) {
  return normalizeString(value).toLowerCase();
}

function resolveLocationPart(locationLike, key) {
  if (!locationLike || typeof locationLike !== "object") return "";
  return normalizeString(locationLike[key]);
}

function hostnameFromLocation(locationLike) {
  return normalizeHost(resolveLocationPart(locationLike, "hostname") || resolveLocationPart(locationLike, "host").split(":")[0]);
}

function hostFromLocation(locationLike) {
  return normalizeHost(resolveLocationPart(locationLike, "host") || resolveLocationPart(locationLike, "hostname"));
}

function isLocalDevelopmentHost(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function isTemporaryPublicHost(hostname) {
  if (!hostname) return false;
  return TEMPORARY_PUBLIC_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix));
}

function shouldUseSameHostFirebaseAuth(locationLike) {
  const host = hostFromLocation(locationLike);
  const hostname = hostnameFromLocation(locationLike);

  if (!host || !hostname) return false;
  if (isLocalDevelopmentHost(hostname)) return false;
  if (isTemporaryPublicHost(hostname)) return false;
  return true;
}

function resolveFirebaseAuthDomain(locationLike, fallback = DEFAULT_FIREBASE_AUTH_DOMAIN) {
  if (shouldUseSameHostFirebaseAuth(locationLike)) {
    return hostFromLocation(locationLike);
  }

  return normalizeString(fallback) || DEFAULT_FIREBASE_AUTH_DOMAIN;
}

export {
  DEFAULT_FIREBASE_AUTH_DOMAIN,
  isTemporaryPublicHost,
  resolveFirebaseAuthDomain,
  shouldUseSameHostFirebaseAuth,
};
