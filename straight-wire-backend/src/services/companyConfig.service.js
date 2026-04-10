'use strict';

const { admin, db } = require('../firebase');
const {
  DEFAULT_MOBILE_COMPANY_CONFIG,
  normalizeMobilePhotoPolicy,
} = require('../utils/mobileContracts');

const SYSTEM_COLLECTION = 'system';
const COMPANY_CONFIG_DOC = 'companyConfig';
const DEFAULT_BACKGROUND_FIT = 'cover';
const VALID_BACKGROUND_FITS = new Set(['cover', 'contain']);
const PORTAL_CARD_ROLES = ['client', 'employee', 'boss'];

const DEFAULT_SERVICE_CATEGORIES = Object.freeze([
  { key: 'electricidad', label: 'Electricidad', icon: '⚡' },
  { key: 'plomeria', label: 'Plomeria', icon: '🔧' },
  { key: 'general', label: 'General', icon: '🛠️' },
]);

const DEFAULT_PORTAL_CARDS = Object.freeze({
  client: {
    title: 'Cliente',
    description: 'Solicitar servicios, ver presupuestos y realizar pagos.',
    ctaLabel: 'Acceder',
    icon: '⚡',
    imageUrl: '',
  },
  employee: {
    title: 'Empleado',
    description: 'Gestion de trabajos, actualizaciones y reportes.',
    ctaLabel: 'Ingresar',
    icon: '🛠️',
    imageUrl: '',
  },
  boss: {
    title: 'Admin',
    description: 'Auditoria, control de calidad y finanzas.',
    ctaLabel: 'Panel Jefe',
    icon: '🛡️',
    imageUrl: '',
  },
});

const DEFAULT_COMPANY_CONFIG = Object.freeze({
  displayName: 'Straight Wire Electric',
  legalName: 'Straight Wire Electric LLC',
  tagline: 'Service Portal',
  logoUrl: 'assets/images/logo.webp',
  backgroundImageUrl: 'assets/images/bg-electric.webp',
  backgrounds: {
    default: {
      url: 'assets/images/bg-electric.webp',
      fit: DEFAULT_BACKGROUND_FIT,
    },
  },
  phone: '3236142546',
  whatsappNumber: '',
  timezone: DEFAULT_MOBILE_COMPANY_CONFIG.timezone,
  locale: DEFAULT_MOBILE_COMPANY_CONFIG.locale,
  currency: DEFAULT_MOBILE_COMPANY_CONFIG.currency,
  photoPolicy: DEFAULT_MOBILE_COMPANY_CONFIG.photoPolicy,
  email: 'straightwireelectric@gmail.com',
  address: '3828 S Grand Ave Apt 207, Los Angeles, CA 90037',
  ein: '39-4757804',
  serviceCategories: DEFAULT_SERVICE_CATEGORIES,
  portalCards: DEFAULT_PORTAL_CARDS,
  estimate: {
    title: 'Quote',
    defaultNotes: [
      'Estimate valid for 30 days.',
      '50% deposit required, balance due upon completion.',
      'Thank you for your business!',
    ].join('\n'),
  },
});

function cloneDefaults() {
  return JSON.parse(JSON.stringify(DEFAULT_COMPANY_CONFIG));
}

function cleanString(value, maxLength = 5000) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

function normalizeLocaleValue(value, fallback = DEFAULT_MOBILE_COMPANY_CONFIG.locale) {
  return cleanString(value, 20).replace(/_/g, '-') || fallback;
}

function normalizeTimezoneValue(value, fallback = DEFAULT_MOBILE_COMPANY_CONFIG.timezone) {
  return cleanString(value, 80) || fallback;
}

function normalizeCurrencyValue(value, fallback = DEFAULT_MOBILE_COMPANY_CONFIG.currency) {
  const normalized = cleanString(value, 3).toUpperCase();
  return /^[A-Z]{3}$/.test(normalized) ? normalized : fallback;
}

function slugifyKey(value, maxLength = 40) {
  const raw = cleanString(value, 120)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return raw.slice(0, maxLength);
}

function normalizeBackgroundKey(value) {
  const key = cleanString(value, 60).toLowerCase();
  if (!key) return '';
  return /^[a-z0-9_-]+$/.test(key) ? key : '';
}

function normalizeBackgroundFit(value, fallback = DEFAULT_BACKGROUND_FIT) {
  const fit = cleanString(value, 20).toLowerCase();
  if (VALID_BACKGROUND_FITS.has(fit)) return fit;
  return VALID_BACKGROUND_FITS.has(fallback) ? fallback : DEFAULT_BACKGROUND_FIT;
}

function normalizeBackgroundEntry(input = {}, fallback = {}) {
  const source = typeof input === 'string' ? { url: input } : (input && typeof input === 'object' ? input : {});
  const fallbackSource = fallback && typeof fallback === 'object' ? fallback : {};
  const url = cleanString(source.url || source.backgroundImageUrl, 2000) || cleanString(fallbackSource.url, 2000);
  const fit = normalizeBackgroundFit(source.fit, fallbackSource.fit);
  return { url, fit };
}

function normalizeEstimateConfig(input = {}) {
  const base = cloneDefaults().estimate;
  const source = input && typeof input === 'object' ? input : {};

  return {
    title: cleanString(source.title, 120) || base.title,
    defaultNotes: cleanString(source.defaultNotes, 6000) || base.defaultNotes,
  };
}

function normalizeServiceCategories(input) {
  const fallback = cloneDefaults().serviceCategories || [];
  const source = Array.isArray(input) ? input : fallback;
  const seen = new Set();
  const normalized = [];

  source.forEach((entry, index) => {
    const raw = entry && typeof entry === 'object' ? entry : {};
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
    ...(fallback && typeof fallback === 'object' ? fallback : {}),
  };
  const source = input && typeof input === 'object' ? input : {};

  return {
    title: cleanString(source.title, 80) || base.title || '',
    description: cleanString(source.description, 240) || base.description || '',
    ctaLabel: cleanString(source.ctaLabel, 60) || base.ctaLabel || '',
    icon: cleanString(source.icon, 16) || base.icon || '',
    imageUrl: cleanString(source.imageUrl, 2000),
  };
}

function normalizePortalCards(input = {}, fallback = {}) {
  const defaults = cloneDefaults().portalCards || {};
  const source = input && typeof input === 'object' ? input : {};
  const previous = fallback && typeof fallback === 'object' ? fallback : {};
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

function mergeCompanyConfig(...sources) {
  const base = cloneDefaults();

  sources.forEach((source) => {
    if (!source || typeof source !== 'object') return;

    const next = source;
    const displayName = cleanString(next.displayName, 160);
    const legalName = cleanString(next.legalName, 200);
    const tagline = cleanString(next.tagline, 200);
    const logoUrl = cleanString(next.logoUrl, 2000);
    const backgroundImageUrl = cleanString(next.backgroundImageUrl, 2000);
    const phone = cleanString(next.phone, 80);
    const whatsappNumber = cleanString(next.whatsappNumber, 40);
    const timezone = normalizeTimezoneValue(next.timezone, base.timezone);
    const locale = normalizeLocaleValue(next.locale, base.locale);
    const currency = normalizeCurrencyValue(next.currency, base.currency);
    const email = cleanString(next.email, 200);
    const address = cleanString(next.address, 400);
    const ein = cleanString(next.ein, 80);

    if (displayName) base.displayName = displayName;
    if (legalName) base.legalName = legalName;
    if (tagline) base.tagline = tagline;
    if (logoUrl) base.logoUrl = logoUrl;
    if (backgroundImageUrl) {
      base.backgroundImageUrl = backgroundImageUrl;
      base.backgrounds.default = normalizeBackgroundEntry(
        { url: backgroundImageUrl },
        base.backgrounds.default,
      );
    }
    if (phone) base.phone = phone;
    if (whatsappNumber) base.whatsappNumber = whatsappNumber;
    if (timezone) base.timezone = timezone;
    if (locale) base.locale = locale;
    if (currency) base.currency = currency;
    if (email) base.email = email;
    if (address) base.address = address;
    if (ein) base.ein = ein;

    if (next.photoPolicy && typeof next.photoPolicy === 'object') {
      base.photoPolicy = normalizeMobilePhotoPolicy(next.photoPolicy, base.photoPolicy);
    }

    if (Array.isArray(next.serviceCategories)) {
      base.serviceCategories = normalizeServiceCategories(next.serviceCategories);
    }

    if (next.portalCards && typeof next.portalCards === 'object') {
      base.portalCards = normalizePortalCards(next.portalCards, base.portalCards);
    }

    if (next.estimate && typeof next.estimate === 'object') {
      base.estimate = normalizeEstimateConfig({
        ...base.estimate,
        ...next.estimate,
      });
    }

    if (next.backgrounds && typeof next.backgrounds === 'object') {
      Object.entries(next.backgrounds).forEach(([rawKey, rawEntry]) => {
        const key = normalizeBackgroundKey(rawKey);
        if (!key) return;

        const fallback = base.backgrounds[key] || base.backgrounds.default;
        const entry = normalizeBackgroundEntry(rawEntry, fallback);
        if (!entry.url && key !== 'default') return;

        base.backgrounds[key] = entry;
        if (key === 'default' && entry.url) {
          base.backgroundImageUrl = entry.url;
        }
      });
    }
  });

  if (!base.backgrounds.default || !base.backgrounds.default.url) {
    base.backgrounds.default = normalizeBackgroundEntry(
      { url: base.backgroundImageUrl || cloneDefaults().backgroundImageUrl },
      base.backgrounds.default,
    );
  }
  base.backgroundImageUrl = base.backgrounds.default.url || base.backgroundImageUrl;
  base.serviceCategories = normalizeServiceCategories(base.serviceCategories);
  base.portalCards = normalizePortalCards(base.portalCards, base.portalCards);
  base.timezone = normalizeTimezoneValue(base.timezone, DEFAULT_MOBILE_COMPANY_CONFIG.timezone);
  base.locale = normalizeLocaleValue(base.locale, DEFAULT_MOBILE_COMPANY_CONFIG.locale);
  base.currency = normalizeCurrencyValue(base.currency, DEFAULT_MOBILE_COMPANY_CONFIG.currency);
  base.photoPolicy = normalizeMobilePhotoPolicy(base.photoPolicy, DEFAULT_MOBILE_COMPANY_CONFIG.photoPolicy);

  return base;
}

async function getCompanyConfig() {
  const snap = await db.collection(SYSTEM_COLLECTION).doc(COMPANY_CONFIG_DOC).get();
  const stored = snap.exists ? snap.data() || {} : {};
  return mergeCompanyConfig(stored);
}

async function updateCompanyConfig(patch = {}, meta = {}) {
  const current = await getCompanyConfig();
  const next = mergeCompanyConfig(current, patch);

  await db.collection(SYSTEM_COLLECTION).doc(COMPANY_CONFIG_DOC).set(
    {
      ...next,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: meta && meta.uid ? String(meta.uid).trim() : null,
    },
    { merge: true },
  );

  return getCompanyConfig();
}

module.exports = {
  DEFAULT_COMPANY_CONFIG,
  mergeCompanyConfig,
  getCompanyConfig,
  updateCompanyConfig,
};
