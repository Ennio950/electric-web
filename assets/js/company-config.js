import { getApiBase } from "./runtime-config.js";

const COMPANY_CONFIG_CACHE_KEY = "swe:companyConfig";
const DEFAULT_BACKGROUND_FIT = "cover";
const VALID_BACKGROUND_FITS = new Set(["cover", "contain"]);
const PORTAL_CARD_ROLES = ["client", "employee", "boss"];

export const DEFAULT_SERVICE_CATEGORIES = Object.freeze([
  { key: "electricidad", label: "Electricidad", icon: "⚡" },
  { key: "plomeria", label: "Plomeria", icon: "🔧" },
  { key: "general", label: "General", icon: "🛠️" },
]);

export const DEFAULT_PORTAL_CARDS = Object.freeze({
  client: {
    title: "Cliente",
    description: "Solicitar servicios, ver presupuestos y realizar pagos.",
    ctaLabel: "Acceder",
    icon: "⚡",
    imageUrl: "",
  },
  employee: {
    title: "Empleado",
    description: "Gestion de trabajos, actualizaciones y reportes.",
    ctaLabel: "Ingresar",
    icon: "🛠️",
    imageUrl: "",
  },
  boss: {
    title: "Admin",
    description: "Auditoria, control de calidad y finanzas.",
    ctaLabel: "Panel Jefe",
    icon: "🛡️",
    imageUrl: "",
  },
});

export const DEFAULT_COMPANY_CONFIG = Object.freeze({
  displayName: "Straight Wire Electric",
  legalName: "Straight Wire Electric LLC",
  tagline: "Service Portal",
  logoUrl: "assets/images/logo.webp",
  backgroundImageUrl: "assets/images/bg-electric.webp",
  backgrounds: {
    default: {
      url: "assets/images/bg-electric.webp",
      fit: DEFAULT_BACKGROUND_FIT,
    },
  },
  phone: "3236142546",
  whatsappNumber: "",
  email: "straightwireelectric@gmail.com",
  address: "3828 S Grand Ave Apt 207, Los Angeles, CA 90037",
  ein: "39-4757804",
  serviceCategories: DEFAULT_SERVICE_CATEGORIES,
  portalCards: DEFAULT_PORTAL_CARDS,
  estimate: {
    title: "Quote",
    defaultNotes: [
      "Estimate valid for 30 days.",
      "50% deposit required, balance due upon completion.",
      "Thank you for your business!",
    ].join("\n"),
  },
});

function cloneDefaults() {
  return JSON.parse(JSON.stringify(DEFAULT_COMPANY_CONFIG));
}

function cleanString(value, max = 6000) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function slugifyKey(value, max = 40) {
  return cleanString(value, 120)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max);
}

function normalizeBackgroundKey(value) {
  const key = cleanString(value, 60).toLowerCase();
  if (!key) return "";
  return /^[a-z0-9_-]+$/.test(key) ? key : "";
}

function normalizeBackgroundFit(value, fallback = DEFAULT_BACKGROUND_FIT) {
  const fit = cleanString(value, 20).toLowerCase();
  if (VALID_BACKGROUND_FITS.has(fit)) return fit;
  return VALID_BACKGROUND_FITS.has(fallback) ? fallback : DEFAULT_BACKGROUND_FIT;
}

function normalizeBackgroundEntry(input = {}, fallback = {}) {
  const source = typeof input === "string" ? { url: input } : (input && typeof input === "object" ? input : {});
  const fallbackSource = fallback && typeof fallback === "object" ? fallback : {};
  const url = cleanString(source.url || source.backgroundImageUrl, 2000) || cleanString(fallbackSource.url, 2000);
  const fit = normalizeBackgroundFit(source.fit, fallbackSource.fit);
  return { url, fit };
}

export function normalizeServiceCategories(input) {
  const fallback = cloneDefaults().serviceCategories || [];
  const source = Array.isArray(input) ? input : fallback;
  const seen = new Set();
  const normalized = [];

  source.forEach((entry, index) => {
    const raw = entry && typeof entry === "object" ? entry : {};
    const label = cleanString(raw.label || raw.name, 80);
    const key = slugifyKey(raw.key || raw.id || raw.value || label || `categoria-${index + 1}`);
    if (!key || seen.has(key)) return;
    normalized.push({
      key,
      label: label || key,
      icon: cleanString(raw.icon, 16),
    });
    seen.add(key);
  });

  return normalized.length ? normalized : fallback;
}

function normalizePortalCardEntry(role, input = {}, fallback = {}) {
  const defaults = cloneDefaults().portalCards || {};
  const base = {
    ...(defaults[role] || {}),
    ...(fallback && typeof fallback === "object" ? fallback : {}),
  };
  const source = input && typeof input === "object" ? input : {};

  return {
    title: cleanString(source.title, 80) || base.title || "",
    description: cleanString(source.description, 240) || base.description || "",
    ctaLabel: cleanString(source.ctaLabel, 60) || base.ctaLabel || "",
    icon: cleanString(source.icon, 16) || base.icon || "",
    imageUrl: cleanString(source.imageUrl, 2000),
  };
}

export function normalizePortalCards(input = {}, fallback = {}) {
  const defaults = cloneDefaults().portalCards || {};
  const source = input && typeof input === "object" ? input : {};
  const previous = fallback && typeof fallback === "object" ? fallback : {};
  const result = {};

  PORTAL_CARD_ROLES.forEach((role) => {
    result[role] = normalizePortalCardEntry(
      role,
      source[role],
      previous[role] || defaults[role] || {},
    );
  });

  return result;
}

export function mergeCompanyConfig(...sources) {
  const base = cloneDefaults();

  sources.forEach((source) => {
    if (!source || typeof source !== "object") return;

    const displayName = cleanString(source.displayName, 160);
    const legalName = cleanString(source.legalName, 200);
    const tagline = cleanString(source.tagline, 200);
    const logoUrl = cleanString(source.logoUrl, 2000);
    const backgroundImageUrl = cleanString(source.backgroundImageUrl, 2000);
    const phone = cleanString(source.phone, 80);
    const whatsappNumber = cleanString(source.whatsappNumber, 40);
    const email = cleanString(source.email, 200);
    const address = cleanString(source.address, 400);
    const ein = cleanString(source.ein, 80);

    if (displayName) base.displayName = displayName;
    if (legalName) base.legalName = legalName;
    if (tagline) base.tagline = tagline;
    if (logoUrl) base.logoUrl = logoUrl;
    if (backgroundImageUrl) {
      base.backgroundImageUrl = backgroundImageUrl;
      base.backgrounds.default = normalizeBackgroundEntry({ url: backgroundImageUrl }, base.backgrounds.default);
    }
    if (phone) base.phone = phone;
    if (whatsappNumber) base.whatsappNumber = whatsappNumber;
    if (email) base.email = email;
    if (address) base.address = address;
    if (ein) base.ein = ein;

    if (Array.isArray(source.serviceCategories)) {
      base.serviceCategories = normalizeServiceCategories(source.serviceCategories);
    }

    if (source.portalCards && typeof source.portalCards === "object") {
      base.portalCards = normalizePortalCards(source.portalCards, base.portalCards);
    }

    if (source.estimate && typeof source.estimate === "object") {
      const title = cleanString(source.estimate.title, 120);
      const defaultNotes = cleanString(source.estimate.defaultNotes, 6000);
      if (title) base.estimate.title = title;
      if (defaultNotes) base.estimate.defaultNotes = defaultNotes;
    }

    if (source.backgrounds && typeof source.backgrounds === "object") {
      Object.entries(source.backgrounds).forEach(([rawKey, rawEntry]) => {
        const key = normalizeBackgroundKey(rawKey);
        if (!key) return;

        const fallback = base.backgrounds[key] || base.backgrounds.default;
        const entry = normalizeBackgroundEntry(rawEntry, fallback);
        if (!entry.url && key !== "default") return;

        base.backgrounds[key] = entry;
        if (key === "default" && entry.url) {
          base.backgroundImageUrl = entry.url;
        }
      });
    }
  });

  if (!base.backgrounds.default || !base.backgrounds.default.url) {
    base.backgrounds.default = normalizeBackgroundEntry(
      { url: base.backgroundImageUrl || cloneDefaults().backgroundImageUrl },
      base.backgrounds.default
    );
  }
  base.backgroundImageUrl = base.backgrounds.default.url || base.backgroundImageUrl;
  base.serviceCategories = normalizeServiceCategories(base.serviceCategories);
  base.portalCards = normalizePortalCards(base.portalCards, base.portalCards);

  return base;
}

export function resolveCompanySurfaceKey() {
  const bodySurface = cleanString(document.body?.dataset?.companySurface || "", 60).toLowerCase();
  if (bodySurface) return bodySurface;

  const path = String(window.location.pathname || "").split("/").pop()?.toLowerCase() || "";
  const map = {
    "index.html": "hub",
    "login-gateway.html": "login-client",
    "login-empleado.html": "login-employee",
    "login-jefe.html": "login-boss",
    "panel-cliente.html": "panel-client",
    "panel-empleado.html": "panel-employee",
    "panel-jefe.html": "panel-boss",
    "client-requests.html": "client-requests",
    "estimate-form.html": "estimate-form",
  };
  return map[path] || "default";
}

export function resolveCompanyBackground(configInput, surfaceKeyInput = resolveCompanySurfaceKey()) {
  const config = mergeCompanyConfig(configInput);
  const surfaceKey = normalizeBackgroundKey(surfaceKeyInput) || "default";
  const backgrounds = config.backgrounds || {};
  const fallbackEntry = backgrounds.default || { url: config.backgroundImageUrl, fit: DEFAULT_BACKGROUND_FIT };
  const surfaceEntry = backgrounds[surfaceKey] || fallbackEntry;

  return {
    surfaceKey,
    url: cleanString(surfaceEntry.url, 2000) || cleanString(config.backgroundImageUrl, 2000),
    fit: normalizeBackgroundFit(surfaceEntry.fit, fallbackEntry.fit),
  };
}

export function getCachedCompanyConfig() {
  try {
    const raw = localStorage.getItem(COMPANY_CONFIG_CACHE_KEY);
    if (!raw) return cloneDefaults();
    const parsed = JSON.parse(raw);
    return mergeCompanyConfig(parsed);
  } catch (_) {
    return cloneDefaults();
  }
}

export function cacheCompanyConfig(config) {
  const normalized = mergeCompanyConfig(config);
  try {
    localStorage.setItem(COMPANY_CONFIG_CACHE_KEY, JSON.stringify(normalized));
  } catch (_) {
    // ignore storage restrictions
  }
  return normalized;
}

export async function loadCompanyConfig(options = {}) {
  const { force = false } = options;
  const cached = getCachedCompanyConfig();

  if (!force) {
    try {
      const response = await fetch(`${getApiBase(window)}/public/company-config`, {
        headers: {
          "ngrok-skip-browser-warning": "true",
        },
      });

      if (!response.ok) {
        return cached;
      }

      const payload = await response.json().catch(() => ({}));
      const config = mergeCompanyConfig(payload?.data || payload || {});
      return cacheCompanyConfig(config);
    } catch (_) {
      return cached;
    }
  }

  try {
    const response = await fetch(`${getApiBase(window)}/public/company-config`, {
      headers: {
        "ngrok-skip-browser-warning": "true",
      },
    });
    if (!response.ok) return cached;
    const payload = await response.json().catch(() => ({}));
    const config = mergeCompanyConfig(payload?.data || payload || {});
    return cacheCompanyConfig(config);
  } catch (_) {
    return cached;
  }
}

function replaceTitleBranding(title, config) {
  return String(title || "")
    .replace(/Electric Web LLC/g, config.legalName)
    .replace(/Electric Web/g, config.displayName)
    .replace(/Straight Wire Electric LLC/g, config.legalName)
    .replace(/Straight Wire Electric/g, config.displayName);
}

function applyText(selector, value) {
  if (!value) return;
  document.querySelectorAll(selector).forEach((node) => {
    node.textContent = value;
  });
}

function applyImage(selector, url, altText) {
  if (!url) return;
  document.querySelectorAll(selector).forEach((node) => {
    if (!(node instanceof HTMLImageElement)) return;
    node.setAttribute("data-company-logo", "1");
    node.src = url;
    node.alt = altText || node.alt || "Logo";
  });
}

function applyPortalCards(config) {
  const cards = normalizePortalCards(config?.portalCards, config?.portalCards);

  PORTAL_CARD_ROLES.forEach((role) => {
    const card = cards[role] || {};
    applyText(`[data-company-role-title="${role}"]`, card.title);
    applyText(`[data-company-role-description="${role}"]`, card.description);
    applyText(`[data-company-role-cta="${role}"]`, card.ctaLabel);

    document.querySelectorAll(`[data-company-role-icon="${role}"]`).forEach((node) => {
      node.textContent = card.icon || "";
      node.classList.toggle("hidden", Boolean(card.imageUrl));
    });

    document.querySelectorAll(`[data-company-role-image="${role}"]`).forEach((node) => {
      if (!(node instanceof HTMLImageElement)) return;
      if (card.imageUrl) {
        node.src = card.imageUrl;
        node.alt = card.title || role;
        node.classList.remove("hidden");
      } else {
        node.removeAttribute("src");
        node.classList.add("hidden");
      }
    });
  });
}

function replaceDefaultBrandNodes(config) {
  if (!document.body) return;

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node || !node.nodeValue || !node.parentElement) return NodeFilter.FILTER_REJECT;
      const tagName = node.parentElement.tagName;
      if (["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA"].includes(tagName)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const replacements = [
    ["Electric Web LLC", config.legalName],
    ["Electric Web", config.displayName],
    ["Straight Wire Electric LLC", config.legalName],
    ["Straight Wire Electric", config.displayName],
    ["Service Portal", config.tagline],
  ];

  let current = walker.nextNode();
  while (current) {
    let text = current.nodeValue || "";
    replacements.forEach(([from, to]) => {
      if (!from || !to) return;
      if (text.includes(from)) {
        text = text.split(from).join(to);
      }
    });
    current.nodeValue = text;
    current = walker.nextNode();
  }
}

export function applyCompanyBranding(configInput, options = {}) {
  const config = mergeCompanyConfig(configInput);
  const applyBackground = options.applyBackground !== false && document.body?.dataset?.companyNoBackground !== "1";
  const root = document.documentElement;
  const originalTitle = root?.dataset?.companyOriginalTitle || document.title;

  if (root && !root.dataset.companyOriginalTitle) {
    root.dataset.companyOriginalTitle = document.title;
  }

  document.title = replaceTitleBranding(originalTitle, config);

  applyText("[data-company-display-name]", config.displayName);
  applyText("[data-company-legal-name]", config.legalName);
  applyText("[data-company-tagline]", config.tagline);
  applyText("[data-company-phone]", config.phone);
  applyText("[data-company-whatsapp-number]", config.whatsappNumber);
  applyText("[data-company-email]", config.email);
  applyText("[data-company-address]", config.address);
  applyText("[data-company-ein]", config.ein);
  applyText("[data-company-estimate-title]", config.estimate.title);
  applyPortalCards(config);

  applyImage("[data-company-logo], img[src*=\"logo.webp\"], img[alt*=\"Straight Wire\"], img[alt*=\"Electric Web\"]", config.logoUrl, config.displayName);

  if (applyBackground && document.body) {
    const background = resolveCompanyBackground(config, options.surfaceKey);
    if (background.url) {
      document.body.style.backgroundImage = `url("${background.url}")`;
      document.body.style.backgroundSize = background.fit;
      document.body.style.backgroundPosition = "center center";
      document.body.style.backgroundRepeat = "no-repeat";
    }
  }

  replaceDefaultBrandNodes(config);
  return config;
}
