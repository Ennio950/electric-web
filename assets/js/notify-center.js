const STYLE_ID = "swe-notify-center-style-v3";

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .swe-notify-root {
      position: fixed;
      z-index: 12000;
      pointer-events: none;
      font-family: "Manrope", "Segoe UI", sans-serif;
      color: #dbeafe;
    }
    .swe-notify-root.top-right { top: 16px; right: 16px; }
    .swe-notify-root.top-left { top: 16px; left: 16px; }
    .swe-notify-root.bottom-right { bottom: 16px; right: 16px; }
    .swe-notify-root.bottom-left { bottom: 16px; left: 16px; }

    .swe-notify-bell {
      pointer-events: auto;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      border: 1px solid rgba(129, 183, 255, 0.45);
      border-radius: 999px;
      background: linear-gradient(180deg, rgba(15, 37, 72, 0.95), rgba(8, 21, 43, 0.95));
      color: #dbeafe;
      font-size: 0.8rem;
      font-weight: 800;
      padding: 8px 12px;
      cursor: pointer;
      box-shadow: 0 12px 30px rgba(2, 8, 20, 0.52);
    }
    .swe-notify-bell:hover {
      filter: brightness(1.06);
      transform: translateY(-1px);
    }
    .swe-notify-icon {
      width: 20px;
      height: 20px;
      border-radius: 999px;
      border: 1px solid rgba(148, 197, 255, 0.45);
      background: rgba(30, 64, 175, 0.45);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
      line-height: 1;
      color: #bfdbfe;
    }
    .swe-notify-badge {
      min-width: 18px;
      height: 18px;
      border-radius: 999px;
      border: 1px solid rgba(252, 165, 165, 0.5);
      background: rgba(239, 68, 68, 0.9);
      color: #fff;
      font-size: 0.68rem;
      font-weight: 800;
      padding: 0 6px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
    }
    .swe-notify-badge.hidden { display: none; }

    .swe-notify-panel {
      pointer-events: auto;
      width: min(440px, 94vw);
      margin-top: 8px;
      border: 1px solid rgba(132, 187, 255, 0.38);
      border-radius: 14px;
      background: linear-gradient(170deg, rgba(5, 18, 42, 0.97), rgba(3, 13, 31, 0.97));
      box-shadow: 0 22px 54px rgba(2, 10, 25, 0.62);
      overflow: hidden;
    }
    .swe-notify-panel[hidden] { display: none !important; }
    .swe-notify-head {
      display: grid;
      gap: 8px;
      padding: 10px 12px;
      border-bottom: 1px solid rgba(123, 177, 255, 0.24);
      background: rgba(8, 24, 51, 0.86);
    }
    .swe-notify-summary {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      margin-top: -2px;
    }
    .swe-notify-summary-chip {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 3px 8px;
      border: 1px solid rgba(141, 194, 255, 0.28);
      background: rgba(10, 29, 58, 0.75);
      color: #b9d5fb;
      font-size: 0.64rem;
      font-weight: 700;
      line-height: 1;
    }
    .swe-notify-summary-chip.has-unread {
      border-color: rgba(251, 191, 36, 0.4);
      color: #fde68a;
      background: rgba(120, 53, 15, 0.32);
    }
    .swe-notify-tabs {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }
    .swe-notify-tab {
      border: 1px solid rgba(141, 194, 255, 0.28);
      border-radius: 999px;
      background: rgba(10, 29, 58, 0.75);
      color: #bfdbfe;
      font-size: 0.66rem;
      font-weight: 800;
      line-height: 1;
      padding: 4px 8px;
      cursor: pointer;
    }
    .swe-notify-tab.active {
      border-color: rgba(96, 165, 250, 0.48);
      background: rgba(30, 64, 175, 0.34);
      color: #dbeafe;
    }
    .swe-notify-tab.has-unread {
      border-color: rgba(251, 191, 36, 0.42);
      color: #fde68a;
    }
    .swe-notify-tab:hover { filter: brightness(1.05); }
    .swe-notify-head-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .swe-notify-tools {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .swe-notify-search {
      flex: 1 1 220px;
      min-width: 180px;
      border: 1px solid rgba(141, 194, 255, 0.3);
      border-radius: 8px;
      background: rgba(12, 35, 70, 0.92);
      color: #d2e7ff;
      font-size: 0.72rem;
      font-weight: 700;
      line-height: 1;
      padding: 7px 9px;
    }
    .swe-notify-search::placeholder {
      color: #88a9d7;
      opacity: 0.9;
    }
    .swe-notify-search:focus {
      outline: 2px solid rgba(96, 165, 250, 0.5);
      outline-offset: 1px;
    }
    .swe-notify-title {
      margin: 0;
      font-size: 0.86rem;
      font-weight: 800;
      color: #e2edff;
    }
    .swe-notify-actions {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    .swe-notify-select {
      border: 1px solid rgba(141, 194, 255, 0.3);
      border-radius: 8px;
      background: rgba(12, 35, 70, 0.92);
      color: #d2e7ff;
      font-size: 0.7rem;
      font-weight: 700;
      line-height: 1;
      padding: 6px 8px;
      min-width: 126px;
    }
    .swe-notify-action {
      border: 1px solid rgba(141, 194, 255, 0.3);
      border-radius: 8px;
      background: rgba(14, 37, 75, 0.86);
      color: #d2e7ff;
      font-size: 0.7rem;
      font-weight: 700;
      line-height: 1;
      padding: 6px 8px;
      cursor: pointer;
    }
    .swe-notify-action:hover { filter: brightness(1.06); }
    .swe-notify-action[data-state="off"] {
      border-color: rgba(248, 113, 113, 0.38);
      color: #fecaca;
      background: rgba(127, 29, 29, 0.44);
    }
    .swe-notify-action[data-state="active"] {
      border-color: rgba(251, 191, 36, 0.42);
      color: #fde68a;
      background: rgba(120, 53, 15, 0.34);
    }

    .swe-notify-list {
      max-height: min(54vh, 380px);
      overflow: auto;
      padding: 8px;
      display: grid;
      gap: 8px;
    }
    .swe-notify-empty {
      border: 1px dashed rgba(141, 194, 255, 0.24);
      border-radius: 10px;
      padding: 12px;
      text-align: center;
      font-size: 0.8rem;
      color: #93afd7;
      background: rgba(7, 22, 47, 0.5);
    }
    .swe-notify-item {
      border: 1px solid rgba(143, 196, 255, 0.22);
      border-radius: 11px;
      padding: 10px;
      background: rgba(10, 26, 52, 0.82);
      display: grid;
      gap: 4px;
    }
    .swe-notify-item.read {
      opacity: 0.78;
      border-color: rgba(131, 159, 197, 0.24);
      background: rgba(9, 22, 43, 0.76);
    }
    .swe-notify-item.unread {
      border-color: rgba(251, 191, 36, 0.45);
      box-shadow: inset 0 0 0 1px rgba(251, 191, 36, 0.16);
    }
    .swe-notify-item.clickable {
      cursor: pointer;
      border-color: rgba(96, 165, 250, 0.4);
    }
    .swe-notify-item.clickable:hover {
      filter: brightness(1.05);
      transform: translateY(-1px);
    }
    .swe-notify-item h4 {
      margin: 0;
      font-size: 0.82rem;
      font-weight: 800;
      color: #ecf4ff;
      line-height: 1.2;
    }
    .swe-notify-item p {
      margin: 0;
      font-size: 0.76rem;
      line-height: 1.34;
      color: #c7dcfb;
    }
    .swe-notify-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      font-size: 0.68rem;
      color: #8faad2;
      margin-top: 2px;
    }
    .swe-notify-meta-tags {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    .swe-notify-item-actions {
      display: flex;
      justify-content: flex-end;
      margin-top: 2px;
    }
    .swe-notify-mini {
      border: 1px solid rgba(141, 194, 255, 0.3);
      border-radius: 999px;
      background: rgba(12, 34, 67, 0.88);
      color: #cde2ff;
      font-size: 0.62rem;
      font-weight: 800;
      line-height: 1;
      padding: 4px 8px;
      cursor: pointer;
    }
    .swe-notify-mini:hover { filter: brightness(1.06); }
    .swe-notify-type,
    .swe-notify-priority,
    .swe-notify-tone {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      line-height: 1;
      padding: 3px 7px;
      border: 1px solid transparent;
      font-size: 0.64rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .swe-notify-type {
      color: #bfdbfe;
      background: rgba(30, 64, 175, 0.22);
      border-color: rgba(96, 165, 250, 0.32);
    }
    .swe-prio-high { color: #fecaca; background: rgba(239, 68, 68, 0.18); border-color: rgba(248, 113, 113, 0.36); }
    .swe-prio-medium { color: #fde68a; background: rgba(245, 158, 11, 0.18); border-color: rgba(251, 191, 36, 0.34); }
    .swe-prio-low { color: #bbf7d0; background: rgba(34, 197, 94, 0.16); border-color: rgba(74, 222, 128, 0.32); }
    .swe-tone-info { color: #bfdbfe; background: rgba(37, 99, 235, 0.18); border-color: rgba(96, 165, 250, 0.32); }
    .swe-tone-success { color: #bbf7d0; background: rgba(34, 197, 94, 0.16); border-color: rgba(74, 222, 128, 0.3); }
    .swe-tone-warning { color: #fde68a; background: rgba(245, 158, 11, 0.18); border-color: rgba(251, 191, 36, 0.3); }
    .swe-tone-error { color: #fecaca; background: rgba(239, 68, 68, 0.16); border-color: rgba(248, 113, 113, 0.34); }

    .swe-toast-stack {
      pointer-events: none;
      position: fixed;
      right: 16px;
      bottom: 18px;
      width: min(380px, calc(100vw - 24px));
      z-index: 12001;
      display: grid;
      gap: 8px;
    }
    .swe-toast {
      pointer-events: auto;
      border-radius: 11px;
      border: 1px solid rgba(133, 188, 255, 0.35);
      background: linear-gradient(170deg, rgba(7, 25, 52, 0.96), rgba(5, 17, 38, 0.96));
      box-shadow: 0 14px 34px rgba(2, 8, 22, 0.6);
      padding: 10px;
      display: grid;
      gap: 4px;
      animation: swe-toast-in 180ms ease both;
    }
    .swe-toast.clickable { cursor: pointer; }
    .swe-toast h5 {
      margin: 0;
      font-size: 0.8rem;
      color: #e6f0ff;
      line-height: 1.2;
    }
    .swe-toast p {
      margin: 0;
      font-size: 0.74rem;
      line-height: 1.3;
      color: #c8dbf6;
    }
    .swe-toast.swe-tone-success { border-color: rgba(74, 222, 128, 0.35); }
    .swe-toast.swe-tone-warning { border-color: rgba(251, 191, 36, 0.35); }
    .swe-toast.swe-tone-error { border-color: rgba(248, 113, 113, 0.35); }
    @keyframes swe-toast-in {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(style);
}

function normalizeTone(value) {
  const tone = String(value || "").trim().toLowerCase();
  if (tone === "success" || tone === "warning" || tone === "error") return tone;
  return "info";
}

function normalizeType(value) {
  const type = String(value || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
  return type || "general";
}

function normalizePriority(value) {
  const pr = String(value || "").trim().toLowerCase();
  if (["critical", "urgent", "high", "alta"].includes(pr)) return "high";
  if (["medium", "normal", "media"].includes(pr)) return "medium";
  if (["low", "baja"].includes(pr)) return "low";
  return "medium";
}

function priorityRank(priority) {
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  return 1;
}

function parseSavedList(storageKey) {
  if (!storageKey) return [];
  try {
    const raw = localStorage.getItem(storageKey);
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch (_) {
    return [];
  }
}

function parseSavedBool(storageKey, fallback = true) {
  if (!storageKey) return Boolean(fallback);
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw === "1") return true;
    if (raw === "0") return false;
  } catch (_) {
    // ignore
  }
  return Boolean(fallback);
}

function parseSavedHistory(storageKey) {
  if (!storageKey) return [];
  try {
    const raw = localStorage.getItem(storageKey);
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed.filter((row) => row && typeof row === "object") : [];
  } catch (_) {
    return [];
  }
}

function parseSavedObject(storageKey) {
  if (!storageKey) return null;
  try {
    const raw = localStorage.getItem(storageKey);
    const parsed = JSON.parse(raw || "null");
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (_) {
    return null;
  }
}

function saveSeenList(storageKey, values = []) {
  if (!storageKey) return;
  try {
    localStorage.setItem(storageKey, JSON.stringify(values));
  } catch (_) {
    // Ignore storage issues.
  }
}

function saveHistoryList(storageKey, values = []) {
  if (!storageKey) return;
  try {
    localStorage.setItem(storageKey, JSON.stringify(values));
  } catch (_) {
    // Ignore storage issues.
  }
}

function saveObject(storageKey, value) {
  if (!storageKey) return;
  try {
    localStorage.setItem(storageKey, JSON.stringify(value ?? {}));
  } catch (_) {
    // Ignore storage issues.
  }
}

function saveBool(storageKey, value) {
  if (!storageKey) return;
  try {
    localStorage.setItem(storageKey, value ? "1" : "0");
  } catch (_) {
    // Ignore storage issues.
  }
}

function formatRelativeTime(ts) {
  const ms = Number(ts || 0);
  if (!Number.isFinite(ms) || ms <= 0) return "ahora";
  const diff = Math.max(0, Date.now() - ms);
  if (diff < 60_000) return "hace segundos";
  if (diff < 3_600_000) return `hace ${Math.round(diff / 60_000)} min`;
  if (diff < 86_400_000) return `hace ${Math.round(diff / 3_600_000)} h`;
  return `hace ${Math.round(diff / 86_400_000)} d`;
}

function playNotificationTone(tone) {
  const ToneCtx = window.AudioContext || window.webkitAudioContext;
  if (!ToneCtx) return;

  try {
    const ctx = new ToneCtx();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    const frequencies = { info: 720, success: 820, warning: 620, error: 420 };

    oscillator.type = tone === "error" ? "triangle" : "sine";
    oscillator.frequency.value = frequencies[tone] || frequencies.info;

    gain.gain.value = 0.0001;
    oscillator.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    gain.gain.linearRampToValueAtTime(0.06, now + 0.02);
    gain.gain.linearRampToValueAtTime(0.0001, now + 0.16);
    oscillator.start(now);
    oscillator.stop(now + 0.17);
    oscillator.onended = () => {
      ctx.close().catch(() => {});
    };
  } catch (_) {
    // Browsers can block audio without user interaction.
  }
}

function sanitize(text, fallback = "") {
  const raw = String(text ?? fallback).trim();
  if (!raw) return fallback;
  return raw.replace(/[<>&]/g, "");
}

export function createNotifier(options = {}) {
  ensureStyles();

  const providedTypes = options.typeOptions && typeof options.typeOptions === "object"
    ? options.typeOptions
    : {};

  const typeLabels = { general: "General" };
  Object.entries(providedTypes).forEach(([rawKey, rawLabel]) => {
    const key = normalizeType(rawKey);
    if (!key) return;
    typeLabels[key] = sanitize(rawLabel || key, key);
  });

  const priorityLabels = {
    high: "Alta",
    medium: "Media",
    low: "Baja",
  };

  const config = {
    title: String(options.title || "Notificaciones"),
    position: String(options.position || "top-right"),
    mount: options.mount instanceof HTMLElement ? options.mount : document.body,
    storageKey: String(options.storageKey || "").trim(),
    historyStorageKey: String(options.historyStorageKey || "").trim(),
    maxItems: Math.max(8, Number(options.maxItems || 36)),
    maxSeen: Math.max(80, Number(options.maxSeen || 480)),
    toastMs: Math.max(1200, Number(options.toastMs || 4500)),
    sounds: options.sounds !== false,
    bellLabel: String(options.bellLabel || "Alertas"),
    typeLabels,
    priorityLabels,
    onItemAction: typeof options.onItemAction === "function" ? options.onItemAction : null,
  };

  const seenOrder = parseSavedList(config.storageKey);
  const seenSet = new Set(seenOrder);
  const soundStorageKey = config.storageKey ? `${config.storageKey}:sound` : "";
  const prefsStorageKey = config.storageKey ? `${config.storageKey}:prefs` : "";
  const snoozeStorageKey = config.storageKey ? `${config.storageKey}:snooze-until` : "";
  const historyStorageKey = config.historyStorageKey || (config.storageKey ? `${config.storageKey}:history` : "");
  const savedHistory = parseSavedHistory(historyStorageKey);
  const savedPrefs = parseSavedObject(prefsStorageKey) || {};
  const savedSnoozeUntil = Number(parseSavedObject(snoozeStorageKey)?.until || 0);
  const state = {
    unread: 0,
    panelOpen: false,
    items: [],
    seenOrder,
    seenSet,
    filterRead: normalizeReadFilter(savedPrefs.filterRead || "all"),
    filterType: "all",
    filterPriority: savedPrefs.filterPriority === "all" ? "all" : normalizePriority(savedPrefs.filterPriority || "all"),
    searchQuery: sanitize(savedPrefs.searchQuery || "", ""),
    snoozeUntil: Number.isFinite(savedSnoozeUntil) ? savedSnoozeUntil : 0,
    recentNotifyTs: [],
    burstSuppressed: 0,
    digestTimer: 0,
    soundOn: parseSavedBool(soundStorageKey, config.sounds),
  };
  state.filterType = savedPrefs.filterType === "all"
    ? "all"
    : resolveType(savedPrefs.filterType || "all");

  const root = document.createElement("div");
  root.className = `swe-notify-root ${config.position}`;
  root.innerHTML = `
    <button type="button" class="swe-notify-bell" aria-label="Abrir notificaciones">
      <span class="swe-notify-icon">!</span>
      <span class="swe-notify-label"></span>
      <span class="swe-notify-badge hidden">0</span>
    </button>
    <section class="swe-notify-panel" hidden>
      <div class="swe-notify-head">
        <div class="swe-notify-head-row">
          <h3 class="swe-notify-title"></h3>
          <div class="swe-notify-actions">
            <select class="swe-notify-select" data-action="type"></select>
            <select class="swe-notify-select" data-action="priority"></select>
            <button type="button" class="swe-notify-action" data-action="sound"></button>
            <button type="button" class="swe-notify-action" data-action="snooze"></button>
            <button type="button" class="swe-notify-action" data-action="read-all">Todo leido</button>
            <button type="button" class="swe-notify-action" data-action="unread-all">Todo no leido</button>
            <button type="button" class="swe-notify-action" data-action="clear">Limpiar</button>
          </div>
        </div>
        <div class="swe-notify-tools">
          <input class="swe-notify-search" data-action="search" type="search" placeholder="Buscar alerta, cliente, evento..." />
        </div>
        <div class="swe-notify-tabs"></div>
        <div class="swe-notify-summary"></div>
      </div>
      <div class="swe-notify-list"></div>
    </section>
    <div class="swe-toast-stack" aria-live="polite"></div>
  `;

  config.mount.appendChild(root);

  const bellButton = root.querySelector(".swe-notify-bell");
  const bellLabel = root.querySelector(".swe-notify-label");
  const bellBadge = root.querySelector(".swe-notify-badge");
  const panel = root.querySelector(".swe-notify-panel");
  const panelTitle = root.querySelector(".swe-notify-title");
  const list = root.querySelector(".swe-notify-list");
  const toastStack = root.querySelector(".swe-toast-stack");
  const headActions = root.querySelector(".swe-notify-actions");
  const readTabs = root.querySelector(".swe-notify-tabs");
  const summary = root.querySelector(".swe-notify-summary");
  const typeSelect = root.querySelector("[data-action='type']");
  const prioritySelect = root.querySelector("[data-action='priority']");
  const soundButton = root.querySelector("[data-action='sound']");
  const snoozeButton = root.querySelector("[data-action='snooze']");
  const searchInput = root.querySelector("[data-action='search']");

  bellLabel.textContent = config.bellLabel;
  panelTitle.textContent = config.title;

  function persistSeen() {
    if (!config.storageKey) return;
    saveSeenList(config.storageKey, state.seenOrder.slice(0, config.maxSeen));
  }

  function appendSeen(key) {
    if (!key || state.seenSet.has(key)) return;
    state.seenSet.add(key);
    state.seenOrder.unshift(key);
    if (state.seenOrder.length > config.maxSeen) {
      const tail = state.seenOrder.splice(config.maxSeen);
      tail.forEach((item) => state.seenSet.delete(item));
    }
    persistSeen();
  }

  function cloneAction(action) {
    if (!action || typeof action !== "object") return null;
    try {
      return { ...action };
    } catch (_) {
      return null;
    }
  }

  function toNoticeItem(raw = {}) {
    const title = sanitize(raw.title || "Nueva alerta", "Nueva alerta");
    const message = sanitize(raw.message || "Hay novedades en tu panel.", "Hay novedades en tu panel.");
    const tone = normalizeTone(raw.tone);
    const type = resolveType(raw.type);
    const priority = normalizePriority(raw.priority);
    const ts = Number(raw.ts || Date.now());
    const dedupeKey = sanitize(raw.dedupeKey || raw.key || "");
    const persistKey = sanitize(raw.persistKey || dedupeKey || `${type}:${title}:${message}`, `${type}:${title}:${message}`);
    const fallbackId = `notice_${Date.now()}_${Math.random().toString(16).slice(2, 7)}`;
    return {
      id: sanitize(raw.id || fallbackId, fallbackId),
      ts: Number.isFinite(ts) && ts > 0 ? ts : Date.now(),
      tone,
      type,
      typeLabel: sanitize(config.typeLabels[type] || "General", "General"),
      priority,
      priorityRank: priorityRank(priority),
      priorityLabel: sanitize(config.priorityLabels[priority] || "Media", "Media"),
      title,
      message,
      action: cloneAction(raw.action),
      dedupeKey,
      persistKey,
      read: Boolean(raw.read),
    };
  }

  function serializeItem(item = {}) {
    return {
      id: sanitize(item.id || ""),
      ts: Number(item.ts || 0),
      tone: normalizeTone(item.tone),
      type: resolveType(item.type),
      priority: normalizePriority(item.priority),
      title: sanitize(item.title || "Nueva alerta", "Nueva alerta"),
      message: sanitize(item.message || "Hay novedades en tu panel.", "Hay novedades en tu panel."),
      action: cloneAction(item.action),
      dedupeKey: sanitize(item.dedupeKey || ""),
      persistKey: sanitize(item.persistKey || ""),
      read: Boolean(item.read),
    };
  }

  function persistHistory() {
    if (!historyStorageKey) return;
    saveHistoryList(historyStorageKey, state.items.slice(0, config.maxItems).map((item) => serializeItem(item)));
  }

  function persistPrefs() {
    if (!prefsStorageKey) return;
    saveObject(prefsStorageKey, {
      filterRead: state.filterRead,
      filterType: state.filterType,
      filterPriority: state.filterPriority,
      searchQuery: state.searchQuery,
    });
  }

  function persistSnooze() {
    if (!snoozeStorageKey) return;
    saveObject(snoozeStorageKey, {
      until: Number(state.snoozeUntil || 0),
    });
  }

  function recomputeUnread() {
    state.unread = state.items.reduce((total, item) => total + (item.read ? 0 : 1), 0);
  }

  function normalizeReadFilter(value) {
    const mode = String(value || "").trim().toLowerCase();
    if (mode === "unread") return "unread";
    if (mode === "read") return "read";
    return "all";
  }

  function computeReadCounters() {
    const total = state.items.length;
    const unread = state.unread;
    const read = Math.max(0, total - unread);
    return { total, unread, read };
  }

  function renderReadTabs() {
    const counts = computeReadCounters();
    const rows = [
      { key: "all", label: `Todas (${counts.total})`, hasUnread: false },
      { key: "unread", label: `No leidas (${counts.unread})`, hasUnread: counts.unread > 0 },
      { key: "read", label: `Leidas (${counts.read})`, hasUnread: false },
    ];
    readTabs.innerHTML = rows.map((row) => `
      <button
        type="button"
        class="swe-notify-tab${state.filterRead === row.key ? " active" : ""}${row.hasUnread ? " has-unread" : ""}"
        data-action="read-filter"
        data-value="${row.key}"
      >${row.label}</button>
    `).join("");
  }

  function computeTypeCounters() {
    const counters = { all: { total: state.items.length, unread: 0 }, byType: {} };
    Object.keys(config.typeLabels).forEach((typeKey) => {
      counters.byType[typeKey] = { total: 0, unread: 0 };
    });
    state.items.forEach((item) => {
      const typeKey = resolveType(item.type);
      if (!counters.byType[typeKey]) counters.byType[typeKey] = { total: 0, unread: 0 };
      counters.byType[typeKey].total += 1;
      if (!item.read) {
        counters.byType[typeKey].unread += 1;
        counters.all.unread += 1;
      }
    });
    return counters;
  }

  function renderTypeOptions() {
    const counters = computeTypeCounters();
    const optionsHtml = [
      `<option value="all">Todos (${counters.all.unread}/${counters.all.total})</option>`,
    ];
    Object.entries(config.typeLabels).forEach(([typeKey, label]) => {
      const row = counters.byType[typeKey] || { total: 0, unread: 0 };
      optionsHtml.push(`<option value="${typeKey}">${label} (${row.unread}/${row.total})</option>`);
    });
    typeSelect.innerHTML = optionsHtml.join("");
    if (!typeSelect.querySelector(`option[value="${state.filterType}"]`)) {
      state.filterType = "all";
    }
    typeSelect.value = state.filterType;
  }

  function renderPriorityOptions() {
    prioritySelect.innerHTML = `
      <option value="all">Prioridad: todas</option>
      <option value="high">${config.priorityLabels.high}</option>
      <option value="medium">${config.priorityLabels.medium}</option>
      <option value="low">${config.priorityLabels.low}</option>
    `;
    prioritySelect.value = state.filterPriority;
  }

  function renderSoundButton() {
    soundButton.dataset.state = state.soundOn ? "on" : "off";
    soundButton.textContent = state.soundOn ? "Sonido ON" : "Sonido OFF";
  }

  function renderSearchInput() {
    searchInput.value = state.searchQuery || "";
  }

  function isSnoozed() {
    return Number(state.snoozeUntil || 0) > Date.now();
  }

  function renderSnoozeButton() {
    if (isSnoozed()) {
      const minsLeft = Math.max(1, Math.ceil((Number(state.snoozeUntil || 0) - Date.now()) / 60_000));
      snoozeButton.dataset.state = "active";
      snoozeButton.textContent = `Silencio ${minsLeft}m`;
      return;
    }
    if (Number(state.snoozeUntil || 0) > 0) {
      state.snoozeUntil = 0;
      persistSnooze();
    }
    snoozeButton.dataset.state = "on";
    snoozeButton.textContent = "Silencio 30m";
  }

  function setSnooze(minutes = 0) {
    const mins = Math.max(0, Number(minutes || 0));
    if (mins <= 0) {
      state.snoozeUntil = 0;
      persistSnooze();
      renderSnoozeButton();
      return;
    }
    state.snoozeUntil = Date.now() + (mins * 60_000);
    persistSnooze();
    renderSnoozeButton();
  }

  function renderSummary() {
    const counters = computeTypeCounters();
    const chips = [];
    chips.push(`<span class="swe-notify-summary-chip${counters.all.unread > 0 ? " has-unread" : ""}">Total ${counters.all.unread}/${counters.all.total}</span>`);
    Object.entries(config.typeLabels).forEach(([typeKey, label]) => {
      const row = counters.byType[typeKey] || { total: 0, unread: 0 };
      if (row.total <= 0) return;
      chips.push(`<span class="swe-notify-summary-chip${row.unread > 0 ? " has-unread" : ""}">${label} ${row.unread}/${row.total}</span>`);
    });
    summary.innerHTML = chips.join("");
  }

  function renderBadge() {
    const n = Number(state.unread || 0);
    if (n <= 0) {
      bellBadge.classList.add("hidden");
      bellBadge.textContent = "0";
      return;
    }
    bellBadge.classList.remove("hidden");
    bellBadge.textContent = n > 99 ? "99+" : String(n);
  }

  function visibleItems() {
    const readFiltered = state.filterRead === "all"
      ? state.items
      : state.items.filter((item) => (state.filterRead === "unread" ? !item.read : item.read));
    const typeFiltered = state.filterType === "all"
      ? readFiltered
      : readFiltered.filter((item) => item.type === state.filterType);
    const priorityFiltered = state.filterPriority === "all"
      ? typeFiltered
      : typeFiltered.filter((item) => item.priority === state.filterPriority);
    const query = String(state.searchQuery || "").trim().toLowerCase();
    const searchFiltered = !query
      ? priorityFiltered
      : priorityFiltered.filter((item) => {
        const haystack = `${item.title} ${item.message} ${item.typeLabel} ${item.priorityLabel}`.toLowerCase();
        return haystack.includes(query);
      });

    return [...searchFiltered].sort((a, b) => {
      const rankDiff = Number(b.priorityRank || 0) - Number(a.priorityRank || 0);
      if (rankDiff !== 0) return rankDiff;
      return Number(b.ts || 0) - Number(a.ts || 0);
    });
  }

  function renderList() {
    const rows = visibleItems();
    if (!rows.length) {
      const hasFilter = state.filterRead !== "all" || state.filterType !== "all" || state.filterPriority !== "all" || Boolean(state.searchQuery);
      const emptyText = hasFilter ? "No hay alertas en este filtro." : "Sin novedades por ahora.";
      list.innerHTML = `<div class="swe-notify-empty">${emptyText}</div>`;
      return;
    }
    list.innerHTML = rows.map((item) => `
      <article class="swe-notify-item ${item.read ? "read" : "unread"}${item.action ? " clickable" : ""}" data-notify-id="${item.id}">
        <h4>${item.title}</h4>
        <p>${item.message}</p>
        <div class="swe-notify-meta">
          <span>${formatRelativeTime(item.ts)}</span>
          <span class="swe-notify-meta-tags">
            <span class="swe-notify-type">${item.typeLabel}</span>
            <span class="swe-notify-priority swe-prio-${item.priority}">${item.priorityLabel}</span>
            <span class="swe-notify-tone swe-tone-${item.tone}">${item.tone}</span>
          </span>
        </div>
        <div class="swe-notify-item-actions">
          <button type="button" class="swe-notify-mini" data-action="toggle-read" data-notify-id="${item.id}">
            ${item.read ? "Marcar no leida" : "Marcar leida"}
          </button>
        </div>
      </article>
    `).join("");
  }

  function openPanel() {
    state.panelOpen = true;
    panel.hidden = false;
    renderSnoozeButton();
  }

  function closePanel() {
    state.panelOpen = false;
    panel.hidden = true;
  }

  function togglePanel() {
    if (state.panelOpen) closePanel();
    else openPanel();
  }

  function clearItems() {
    state.items = [];
    state.recentNotifyTs = [];
    state.burstSuppressed = 0;
    if (state.digestTimer) {
      window.clearTimeout(state.digestTimer);
      state.digestTimer = 0;
    }
    recomputeUnread();
    renderBadge();
    renderReadTabs();
    renderTypeOptions();
    renderSummary();
    renderList();
    persistHistory();
  }

  function markAllRead() {
    state.items = state.items.map((item) => ({ ...item, read: true }));
    recomputeUnread();
    renderReadTabs();
    renderTypeOptions();
    renderSummary();
    renderList();
    persistHistory();
    renderBadge();
  }

  function markAllUnread() {
    state.items = state.items.map((item) => ({ ...item, read: false }));
    recomputeUnread();
    renderReadTabs();
    renderTypeOptions();
    renderSummary();
    renderList();
    persistHistory();
    renderBadge();
  }

  function setItemReadById(id, read) {
    const targetId = sanitize(id || "");
    if (!targetId) return;
    let changed = false;
    state.items = state.items.map((item) => {
      if (item.id !== targetId) return item;
      if (item.read === Boolean(read)) return item;
      changed = true;
      return { ...item, read: Boolean(read) };
    });
    if (!changed) return;
    recomputeUnread();
    renderBadge();
    renderReadTabs();
    renderTypeOptions();
    renderSummary();
    renderList();
    persistHistory();
  }

  function showToast(item) {
    const node = document.createElement("article");
    node.className = `swe-toast swe-tone-${item.tone}${item.action ? " clickable" : ""}`;
    node.dataset.notifyId = item.id;
    node.innerHTML = `
      <h5>${item.title}</h5>
      <p>${item.message}</p>
    `;
    toastStack.appendChild(node);
    window.setTimeout(() => {
      node.style.opacity = "0";
      node.style.transform = "translateY(6px)";
      node.style.transition = "opacity 140ms ease, transform 140ms ease";
      window.setTimeout(() => node.remove(), 160);
    }, config.toastMs);
  }

  function flushDigestToast() {
    const suppressed = Number(state.burstSuppressed || 0);
    state.burstSuppressed = 0;
    state.digestTimer = 0;
    if (suppressed <= 0) return;
    if (isSnoozed()) return;
    const digest = toNoticeItem({
      id: `digest_${Date.now()}_${Math.random().toString(16).slice(2, 7)}`,
      tone: "info",
      type: "general",
      priority: "medium",
      title: "Alertas agrupadas",
      message: `${suppressed} alerta(s) nuevas agrupadas para evitar ruido.`,
      ts: Date.now(),
      read: true,
    });
    showToast(digest);
  }

  function shouldSuppressBurst(nowTs = Date.now()) {
    state.recentNotifyTs = state.recentNotifyTs.filter((ts) => (nowTs - Number(ts || 0)) <= 10_000);
    state.recentNotifyTs.push(nowTs);
    if (state.recentNotifyTs.length <= 4) return false;
    state.burstSuppressed += 1;
    if (!state.digestTimer) {
      state.digestTimer = window.setTimeout(() => {
        flushDigestToast();
      }, 2300);
    }
    return true;
  }

  function resolveType(payloadType) {
    const normalized = normalizeType(payloadType || "general");
    if (config.typeLabels[normalized]) return normalized;
    return "general";
  }

  function hydrateHistory() {
    if (!Array.isArray(savedHistory) || !savedHistory.length) {
      state.items = [];
      recomputeUnread();
      return;
    }
    const rows = savedHistory
      .map((raw) => toNoticeItem(raw))
      .sort((a, b) => Number(b.ts || 0) - Number(a.ts || 0))
      .slice(0, config.maxItems);
    state.items = rows;

    let seenMutated = false;
    rows.forEach((item) => {
      if (!item.dedupeKey || state.seenSet.has(item.dedupeKey)) return;
      state.seenSet.add(item.dedupeKey);
      state.seenOrder.unshift(item.dedupeKey);
      seenMutated = true;
    });
    if (state.seenOrder.length > config.maxSeen) {
      const tail = state.seenOrder.splice(config.maxSeen);
      tail.forEach((key) => state.seenSet.delete(key));
      seenMutated = true;
    }
    if (seenMutated) persistSeen();
    recomputeUnread();
  }

  function notify(payload = {}) {
    const dedupeKey = sanitize(payload.dedupeKey || payload.key || "");
    if (dedupeKey && state.seenSet.has(dedupeKey)) return false;

    const tone = normalizeTone(payload.tone);
    const item = toNoticeItem({
      ...payload,
      id: `notice_${Date.now()}_${Math.random().toString(16).slice(2, 7)}`,
      ts: Date.now(),
      tone,
      dedupeKey,
      read: false,
    });

    if (dedupeKey) appendSeen(dedupeKey);

    state.items.unshift(item);
    if (state.items.length > config.maxItems) {
      state.items = state.items.slice(0, config.maxItems);
    }

    recomputeUnread();
    renderBadge();
    renderReadTabs();
    renderTypeOptions();
    renderSummary();
    renderList();
    persistHistory();
    const snoozed = isSnoozed();
    renderSnoozeButton();
    const burstSuppressed = shouldSuppressBurst(item.ts);
    if (!burstSuppressed && !snoozed && payload.toast !== false) showToast(item);
    if (!burstSuppressed && !snoozed && state.soundOn && payload.sound !== false) playNotificationTone(tone);
    return true;
  }

  function rememberKey(dedupeKey) {
    const key = sanitize(dedupeKey || "");
    if (!key) return;
    appendSeen(key);
  }

  function rememberKeys(keys = []) {
    if (!Array.isArray(keys)) return;
    keys.forEach((key) => rememberKey(key));
  }

  function isSeen(dedupeKey) {
    const key = sanitize(dedupeKey || "");
    if (!key) return false;
    return state.seenSet.has(key);
  }

  function setFilter(type = "all") {
    const normalized = type === "all" ? "all" : resolveType(type);
    state.filterType = normalized;
    typeSelect.value = normalized;
    renderList();
    persistPrefs();
  }

  function setPriorityFilter(priority = "all") {
    const normalized = priority === "all" ? "all" : normalizePriority(priority);
    state.filterPriority = normalized;
    prioritySelect.value = normalized;
    renderList();
    persistPrefs();
  }

  function setReadFilter(mode = "all") {
    const normalized = normalizeReadFilter(mode);
    state.filterRead = normalized;
    renderReadTabs();
    renderList();
    persistPrefs();
  }

  function setSearch(value = "") {
    state.searchQuery = sanitize(value || "", "");
    renderSearchInput();
    renderList();
    persistPrefs();
  }

  function setSound(enabled) {
    state.soundOn = Boolean(enabled);
    saveBool(soundStorageKey, state.soundOn);
    renderSoundButton();
  }

  function destroy() {
    if (state.digestTimer) {
      window.clearTimeout(state.digestTimer);
      state.digestTimer = 0;
    }
    if (snoozeTicker) {
      window.clearInterval(snoozeTicker);
    }
    document.removeEventListener("click", onDocumentClick);
    root.remove();
  }

  function runItemAction(item) {
    if (!item?.action || !config.onItemAction) return;
    try {
      config.onItemAction({
        action: item.action,
        item,
      });
    } catch (error) {
      console.error("[notify-center] onItemAction error", error);
    }
  }

  function onItemClick(event) {
    const markButton = event.target?.closest?.("[data-action='toggle-read']");
    if (markButton) return;
    const card = event.target?.closest?.("[data-notify-id]");
    if (!card) return;
    const id = String(card.dataset.notifyId || "");
    if (!id) return;
    const item = state.items.find((row) => row.id === id);
    if (!item) return;
    setItemReadById(id, true);
    runItemAction(item);
  }

  function onListClick(event) {
    const markButton = event.target?.closest?.("[data-action='toggle-read']");
    if (!markButton) {
      onItemClick(event);
      return;
    }
    const id = String(markButton.dataset.notifyId || "");
    if (!id) return;
    const item = state.items.find((row) => row.id === id);
    if (!item) return;
    setItemReadById(id, !item.read);
  }

  bellButton.addEventListener("click", () => {
    togglePanel();
  });

  headActions.addEventListener("click", (event) => {
    const action = event.target?.dataset?.action;
    if (!action) return;
    if (action === "read-all") markAllRead();
    if (action === "unread-all") markAllUnread();
    if (action === "clear") clearItems();
    if (action === "sound") setSound(!state.soundOn);
    if (action === "snooze") setSnooze(isSnoozed() ? 0 : 30);
  });

  typeSelect.addEventListener("change", () => {
    setFilter(typeSelect.value || "all");
  });
  prioritySelect.addEventListener("change", () => {
    setPriorityFilter(prioritySelect.value || "all");
  });
  readTabs.addEventListener("click", (event) => {
    const tab = event.target?.closest?.("[data-action='read-filter']");
    if (!tab) return;
    setReadFilter(String(tab.dataset.value || "all"));
  });
  searchInput.addEventListener("input", () => {
    setSearch(searchInput.value || "");
  });
  list.addEventListener("click", onListClick);
  toastStack.addEventListener("click", onItemClick);

  const onDocumentClick = (event) => {
    if (!root.contains(event.target) && state.panelOpen) {
      closePanel();
    }
  };
  document.addEventListener("click", onDocumentClick);
  const snoozeTicker = window.setInterval(() => {
    renderSnoozeButton();
  }, 15_000);

  hydrateHistory();
  renderReadTabs();
  renderTypeOptions();
  renderPriorityOptions();
  renderSearchInput();
  renderSoundButton();
  renderSnoozeButton();
  renderBadge();
  renderSummary();
  renderList();

  return {
    notify,
    rememberKey,
    rememberKeys,
    isSeen,
    markAllRead,
    markAllUnread,
    clear: clearItems,
    open: openPanel,
    close: closePanel,
    setFilter,
    setPriorityFilter,
    setReadFilter,
    setSearch,
    setSound,
    setSnooze,
    isSoundOn: () => state.soundOn,
    destroy,
  };
}
