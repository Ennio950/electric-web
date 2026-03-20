(function companyBrandingBootstrap() {
  var CACHE_KEY = "swe:companyConfig";
  var DEFAULT_BACKGROUND_FIT = "cover";
  var VALID_BACKGROUND_FITS = { cover: true, contain: true };
  var PORTAL_CARD_ROLES = ["client", "employee", "boss"];
  var DEFAULT_SERVICE_CATEGORIES = [
    { key: "electricidad", label: "Electricidad", icon: "⚡" },
    { key: "plomeria", label: "Plomeria", icon: "🔧" },
    { key: "general", label: "General", icon: "🛠️" },
  ];
  var DEFAULT_PORTAL_CARDS = {
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
  };
  var DEFAULTS = {
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
  };

  function cloneDefaults() {
    return JSON.parse(JSON.stringify(DEFAULTS));
  }

  function cleanString(value, max) {
    if (typeof value !== "string") return "";
    return value.trim().slice(0, max);
  }

  function slugifyKey(value, max) {
    return cleanString(value, 120)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, max || 40);
  }

  function normalizeBackgroundKey(value) {
    var key = cleanString(value, 60).toLowerCase();
    if (!key) return "";
    return /^[a-z0-9_-]+$/.test(key) ? key : "";
  }

  function normalizeBackgroundFit(value, fallback) {
    var fit = cleanString(value, 20).toLowerCase();
    if (VALID_BACKGROUND_FITS[fit]) return fit;
    return VALID_BACKGROUND_FITS[fallback] ? fallback : DEFAULT_BACKGROUND_FIT;
  }

  function normalizeBackgroundEntry(input, fallback) {
    var source = typeof input === "string" ? { url: input } : (input && typeof input === "object" ? input : {});
    var fallbackSource = fallback && typeof fallback === "object" ? fallback : {};
    var url = cleanString(source.url || source.backgroundImageUrl, 2000) || cleanString(fallbackSource.url, 2000);
    var fit = normalizeBackgroundFit(source.fit, fallbackSource.fit);
    return { url: url, fit: fit };
  }

  function normalizeServiceCategories(input) {
    var fallback = cloneDefaults().serviceCategories || [];
    var source = Array.isArray(input) ? input : fallback;
    var seen = {};
    var normalized = [];

    source.forEach(function (entry, index) {
      var raw = entry && typeof entry === "object" ? entry : {};
      var label = cleanString(raw.label || raw.name, 80);
      var key = slugifyKey(raw.key || raw.id || raw.value || label || ("categoria-" + (index + 1)), 40);
      if (!key || seen[key]) return;
      normalized.push({
        key: key,
        label: label || key,
        icon: cleanString(raw.icon, 16),
      });
      seen[key] = true;
    });

    return normalized.length ? normalized : fallback;
  }

  function normalizePortalCardEntry(role, input, fallback) {
    var defaults = cloneDefaults().portalCards || {};
    var base = Object.assign({}, defaults[role] || {}, fallback && typeof fallback === "object" ? fallback : {});
    var source = input && typeof input === "object" ? input : {};

    return {
      title: cleanString(source.title, 80) || base.title || "",
      description: cleanString(source.description, 240) || base.description || "",
      ctaLabel: cleanString(source.ctaLabel, 60) || base.ctaLabel || "",
      icon: cleanString(source.icon, 16) || base.icon || "",
      imageUrl: cleanString(source.imageUrl, 2000),
    };
  }

  function normalizePortalCards(input, fallback) {
    var defaults = cloneDefaults().portalCards || {};
    var source = input && typeof input === "object" ? input : {};
    var previous = fallback && typeof fallback === "object" ? fallback : {};
    var result = {};

    PORTAL_CARD_ROLES.forEach(function (role) {
      result[role] = normalizePortalCardEntry(
        role,
        source[role],
        previous[role] || defaults[role] || {}
      );
    });

    return result;
  }

  function mergeConfig(source) {
    var base = cloneDefaults();
    if (!source || typeof source !== "object") return base;

    var displayName = cleanString(source.displayName, 160);
    var legalName = cleanString(source.legalName, 200);
    var tagline = cleanString(source.tagline, 200);
    var logoUrl = cleanString(source.logoUrl, 2000);
    var backgroundImageUrl = cleanString(source.backgroundImageUrl, 2000);
    var phone = cleanString(source.phone, 80);
    var whatsappNumber = cleanString(source.whatsappNumber, 40);
    var email = cleanString(source.email, 200);
    var address = cleanString(source.address, 400);
    var ein = cleanString(source.ein, 80);

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
      var title = cleanString(source.estimate.title, 120);
      var defaultNotes = cleanString(source.estimate.defaultNotes, 6000);
      if (title) base.estimate.title = title;
      if (defaultNotes) base.estimate.defaultNotes = defaultNotes;
    }

    if (source.backgrounds && typeof source.backgrounds === "object") {
      Object.entries(source.backgrounds).forEach(function (entryPair) {
        var rawKey = entryPair[0];
        var rawEntry = entryPair[1];
        var key = normalizeBackgroundKey(rawKey);
        if (!key) return;

        var fallback = base.backgrounds[key] || base.backgrounds.default;
        var entry = normalizeBackgroundEntry(rawEntry, fallback);
        if (!entry.url && key !== "default") return;

        base.backgrounds[key] = entry;
        if (key === "default" && entry.url) {
          base.backgroundImageUrl = entry.url;
        }
      });
    }

    if (!base.backgrounds.default || !base.backgrounds.default.url) {
      base.backgrounds.default = normalizeBackgroundEntry(
        { url: base.backgroundImageUrl || DEFAULTS.backgroundImageUrl },
        base.backgrounds.default
      );
    }
    base.backgroundImageUrl = base.backgrounds.default.url || base.backgroundImageUrl;
    base.serviceCategories = normalizeServiceCategories(base.serviceCategories);
    base.portalCards = normalizePortalCards(base.portalCards, base.portalCards);

    return base;
  }

  function getCachedConfig() {
    try {
      var raw = window.localStorage.getItem(CACHE_KEY);
      if (!raw) return cloneDefaults();
      return mergeConfig(JSON.parse(raw));
    } catch (_) {
      return cloneDefaults();
    }
  }

  function replaceTitleBranding(title, config) {
    return String(title || "")
      .replace(/Electric Web LLC/g, config.legalName)
      .replace(/Electric Web/g, config.displayName)
      .replace(/Straight Wire Electric LLC/g, config.legalName)
      .replace(/Straight Wire Electric/g, config.displayName);
  }

  function resolveSurfaceKey() {
    var bodySurface = cleanString(document.body && document.body.dataset ? document.body.dataset.companySurface || "" : "", 60).toLowerCase();
    if (bodySurface) return bodySurface;

    var path = String(window.location.pathname || "").split("/").pop().toLowerCase();
    var map = {
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

  function resolveBackground(config) {
    var surfaceKey = resolveSurfaceKey();
    var backgrounds = config && typeof config === "object" ? config.backgrounds || {} : {};
    var fallbackEntry = backgrounds.default || { url: config.backgroundImageUrl, fit: DEFAULT_BACKGROUND_FIT };
    var surfaceEntry = backgrounds[surfaceKey] || fallbackEntry;

    return {
      url: cleanString(surfaceEntry.url, 2000) || cleanString(config.backgroundImageUrl, 2000),
      fit: normalizeBackgroundFit(surfaceEntry.fit, fallbackEntry.fit),
    };
  }

  function applyText(selector, value) {
    if (!value) return;
    document.querySelectorAll(selector).forEach(function (node) {
      node.textContent = value;
    });
  }

  function applyImage(selector, url, altText) {
    if (!url) return;
    document.querySelectorAll(selector).forEach(function (node) {
      if (!(node instanceof HTMLImageElement)) return;
      node.setAttribute("data-company-logo", "1");
      node.src = url;
      node.alt = altText || node.alt || "Logo";
    });
  }

  function applyPortalCards(config) {
    var cards = normalizePortalCards(config && config.portalCards ? config.portalCards : {});

    PORTAL_CARD_ROLES.forEach(function (role) {
      var card = cards[role] || {};
      applyText("[data-company-role-title=\"" + role + "\"]", card.title);
      applyText("[data-company-role-description=\"" + role + "\"]", card.description);
      applyText("[data-company-role-cta=\"" + role + "\"]", card.ctaLabel);

      document.querySelectorAll("[data-company-role-icon=\"" + role + "\"]").forEach(function (node) {
        node.textContent = card.icon || "";
        node.classList.toggle("hidden", !!card.imageUrl);
      });

      document.querySelectorAll("[data-company-role-image=\"" + role + "\"]").forEach(function (node) {
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

    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        if (!node || !node.nodeValue || !node.parentElement) return NodeFilter.FILTER_REJECT;
        var tagName = node.parentElement.tagName;
        if (["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA"].includes(tagName)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    var replacements = [
      ["Electric Web LLC", config.legalName],
      ["Electric Web", config.displayName],
      ["Straight Wire Electric LLC", config.legalName],
      ["Straight Wire Electric", config.displayName],
      ["Service Portal", config.tagline],
    ];

    var current = walker.nextNode();
    while (current) {
      var text = current.nodeValue || "";
      replacements.forEach(function (pair) {
        var from = pair[0];
        var to = pair[1];
        if (from && to && text.includes(from)) {
          text = text.split(from).join(to);
        }
      });
      current.nodeValue = text;
      current = walker.nextNode();
    }
  }

  function applyBranding(configInput) {
    var config = mergeConfig(configInput);
    document.title = replaceTitleBranding(document.documentElement.dataset.companyOriginalTitle || document.title, config);

    applyText("[data-company-display-name]", config.displayName);
    applyText("[data-company-legal-name]", config.legalName);
    applyText("[data-company-tagline]", config.tagline);
    applyText("[data-company-phone]", config.phone);
    applyText("[data-company-whatsapp-number]", config.whatsappNumber);
    applyText("[data-company-email]", config.email);
    applyText("[data-company-address]", config.address);
    applyText("[data-company-ein]", config.ein);
    applyText("[data-company-estimate-title]", config.estimate && config.estimate.title ? config.estimate.title : "");
    applyPortalCards(config);

    applyImage(
      "[data-company-logo], img[src*=\"logo.webp\"], img[alt*=\"Straight Wire\"], img[alt*=\"Electric Web\"]",
      config.logoUrl,
      config.displayName
    );

    if (document.body) {
      var background = resolveBackground(config);
      if (background.url) {
        document.body.style.backgroundImage = "url(\"" + background.url.replace(/"/g, '\\"') + "\")";
        document.body.style.backgroundSize = background.fit;
        document.body.style.backgroundPosition = "center center";
        document.body.style.backgroundRepeat = "no-repeat";
      }
    }

    replaceDefaultBrandNodes(config);
    document.documentElement.dataset.companyBrandState = "ready";
  }

  function installLiveInputGuard() {
    if (window.__SWE_LIVE_INPUT_GUARD__) return;

    var liveState = null;
    var restoreFrame = 0;
    var restoreWindowMs = 1800;
    var mutationObserver = null;

    function isGuardedField(node) {
      if (!node || node.nodeType !== 1 || !node.id) return false;
      if (node.isContentEditable) return true;
      if (!(node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement || node instanceof HTMLSelectElement)) return false;
      var type = String(node.type || "").toLowerCase();
      return !["hidden", "button", "submit", "reset", "image", "range", "color"].includes(type);
    }

    function captureField(node) {
      if (!isGuardedField(node)) return null;
      var hasTextSelection = typeof node.selectionStart === "number" && typeof node.selectionEnd === "number";
      return {
        id: node.id,
        tagName: node.tagName,
        type: String(node.type || "").toLowerCase(),
        value: "value" in node ? node.value : String(node.textContent || ""),
        checked: "checked" in node ? !!node.checked : null,
        selectionStart: hasTextSelection ? node.selectionStart : null,
        selectionEnd: hasTextSelection ? node.selectionEnd : null,
        scrollTop: typeof node.scrollTop === "number" ? node.scrollTop : null,
        scrollLeft: typeof node.scrollLeft === "number" ? node.scrollLeft : null,
        updatedAt: Date.now()
      };
    }

    function remember(node) {
      var snapshot = captureField(node);
      if (snapshot) liveState = snapshot;
      return snapshot;
    }

    function canRestoreFocus() {
      var active = document.activeElement;
      if (!active || active === document.body || active === document.documentElement) return true;
      if (!isGuardedField(active)) return true;
      return !!liveState && active.id === liveState.id;
    }

    function restoreField() {
      restoreFrame = 0;
      if (!liveState) return;
      if (Date.now() - liveState.updatedAt > restoreWindowMs) return;

      var currentActive = document.activeElement;
      if (isGuardedField(currentActive) && currentActive.id === liveState.id) {
        remember(currentActive);
        return;
      }

      var candidate = document.getElementById(liveState.id);
      if (!isGuardedField(candidate)) return;

      if ("checked" in candidate && (liveState.type === "checkbox" || liveState.type === "radio")) {
        candidate.checked = !!liveState.checked;
      } else if (liveState.type !== "file" && "value" in candidate && candidate.value !== liveState.value) {
        candidate.value = liveState.value;
      } else if (candidate.isContentEditable && candidate.textContent !== liveState.value) {
        candidate.textContent = liveState.value;
      }

      if (!canRestoreFocus()) return;

      if (typeof candidate.focus === "function") {
        candidate.focus({ preventScroll: true });
      }
      if (typeof liveState.selectionStart === "number" && typeof candidate.setSelectionRange === "function") {
        candidate.setSelectionRange(liveState.selectionStart, liveState.selectionEnd == null ? liveState.selectionStart : liveState.selectionEnd);
      }
      if (typeof liveState.scrollTop === "number") {
        candidate.scrollTop = liveState.scrollTop;
      }
      if (typeof liveState.scrollLeft === "number") {
        candidate.scrollLeft = liveState.scrollLeft;
      }
    }

    function scheduleRestore() {
      if (!liveState) return;
      if (restoreFrame) window.cancelAnimationFrame(restoreFrame);
      restoreFrame = window.requestAnimationFrame(restoreField);
    }

    function onSelectionChange() {
      remember(document.activeElement);
    }

    document.addEventListener("focusin", function (event) {
      remember(event.target);
    }, true);
    document.addEventListener("input", function (event) {
      remember(event.target);
    }, true);
    document.addEventListener("change", function (event) {
      remember(event.target);
    }, true);
    document.addEventListener("keyup", function (event) {
      remember(event.target);
    }, true);
    document.addEventListener("click", function () {
      remember(document.activeElement);
    }, true);
    document.addEventListener("selectionchange", onSelectionChange, true);

    function startObserver() {
      if (mutationObserver || !document.documentElement) return;
      mutationObserver = new MutationObserver(function () {
        scheduleRestore();
      });
      mutationObserver.observe(document.documentElement, { childList: true, subtree: true });
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", startObserver, { once: true });
    } else {
      startObserver();
    }

    window.addEventListener("beforeunload", function () {
      if (mutationObserver) mutationObserver.disconnect();
      if (restoreFrame) window.cancelAnimationFrame(restoreFrame);
    });

    window.__SWE_LIVE_INPUT_GUARD__ = {
      captureCurrent: function () {
        return remember(document.activeElement);
      },
      scheduleRestore: scheduleRestore,
      restoreNow: restoreField
    };
  }

  var config = getCachedConfig();
  var root = document.documentElement;
  var initialBackground = resolveBackground(config);
  var escapedBackground = String(initialBackground.url || DEFAULTS.backgroundImageUrl).replace(/"/g, '\\"');
  var style = document.createElement("style");
  style.id = "company-branding-bootstrap-style";
  style.textContent = [
    "html[data-company-brand-state=\"booting\"] [data-company-display-name],",
    "html[data-company-brand-state=\"booting\"] [data-company-legal-name],",
    "html[data-company-brand-state=\"booting\"] [data-company-tagline],",
    "html[data-company-brand-state=\"booting\"] [data-company-phone],",
    "html[data-company-brand-state=\"booting\"] [data-company-email],",
    "html[data-company-brand-state=\"booting\"] [data-company-address],",
    "html[data-company-brand-state=\"booting\"] [data-company-ein],",
    "html[data-company-brand-state=\"booting\"] [data-company-estimate-title],",
    "html[data-company-brand-state=\"booting\"] [data-company-role-title],",
    "html[data-company-brand-state=\"booting\"] [data-company-role-description],",
    "html[data-company-brand-state=\"booting\"] [data-company-role-cta],",
    "html[data-company-brand-state=\"booting\"] [data-company-role-icon],",
    "html[data-company-brand-state=\"booting\"] [data-company-role-image],",
    "html[data-company-brand-state=\"booting\"] [data-company-logo],",
    "html[data-company-brand-state=\"booting\"] img[src*=\"logo.webp\"],",
    "html[data-company-brand-state=\"booting\"] img[alt*=\"Straight Wire\"],",
    "html[data-company-brand-state=\"booting\"] img[alt*=\"Electric Web\"] {",
    "  visibility: hidden;",
    "}",
    "body {",
    "  background-image: url(\"" + escapedBackground + "\") !important;",
    "  background-size: " + initialBackground.fit + " !important;",
    "  background-position: center center !important;",
    "  background-repeat: no-repeat !important;",
    "}",
  ].join("\n");

  root.dataset.companyBrandState = "booting";
  if (!root.dataset.companyOriginalTitle) {
    root.dataset.companyOriginalTitle = document.title;
  }
  document.title = replaceTitleBranding(document.title, config);
  document.head.appendChild(style);
  window.__COMPANY_BRANDING_BOOTSTRAP__ = config;
  installLiveInputGuard();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      applyBranding(config);
    }, { once: true });
  } else {
    applyBranding(config);
  }

  window.addEventListener("company-config:loaded", function (event) {
    applyBranding(event && event.detail ? event.detail : config);
  });
})();
