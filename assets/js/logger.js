const LEVELS = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 50,
};

function readLevel() {
  try {
    const stored = String(localStorage.getItem("swe:logLevel") || "").trim().toLowerCase();
    if (stored && LEVELS[stored] != null) return stored;
  } catch (_) {
    // ignore storage restrictions
  }

  const params = new URLSearchParams(window.location.search || "");
  const debugFlag = String(params.get("debug") || "").trim();
  if (debugFlag === "1" || debugFlag.toLowerCase() === "true") return "debug";
  return "warn";
}

function shouldLog(level) {
  return (LEVELS[level] || LEVELS.info) >= (LEVELS[readLevel()] || LEVELS.warn);
}

export function createLogger(scope = "app") {
  const prefix = `[${String(scope || "app").trim() || "app"}]`;
  return {
    debug(...args) {
      if (shouldLog("debug")) console.debug(prefix, ...args);
    },
    info(...args) {
      if (shouldLog("info")) console.info(prefix, ...args);
    },
    warn(...args) {
      if (shouldLog("warn")) console.warn(prefix, ...args);
    },
    error(...args) {
      if (shouldLog("error")) console.error(prefix, ...args);
    },
  };
}
