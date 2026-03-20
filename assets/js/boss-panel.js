import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut, getIdTokenResult } from "../vendor/firebase/firebase-auth.js";

import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  getDoc,
  doc,
  runTransaction,
  serverTimestamp
} from "../vendor/firebase/firebase-firestore.js";
import { apiFetch, API_BASE, uploadImage } from "./api.js?v=20260310b";
import {
  applyCompanyBranding,
  cacheCompanyConfig,
  loadCompanyConfig,
  mergeCompanyConfig,
  normalizePortalCards,
  normalizeServiceCategories,
  resolveCompanyBackground,
} from "./company-config.js?v=20260310a";
import { createNotifier } from "./notify-center.js";
import { clearPortalSession, syncPortalSessionFromUser } from "./portal-session.js";
const ESTIMATE_REQUEST_PREFILL_KEY = "estimateRequestPrefill";
const BOSS_COMMISSION_RATE = 0.20;

// ✅ CAMBIÁ ESTO
const BOSS_EMAILS = [
  "boss@straightwireelectric.com"
];

const list = document.getElementById("list");
const empty = document.getElementById("empty");
const bossPill = document.getElementById("bossPill");
const rtPill = document.getElementById("rtPill");

const kNew = document.getElementById("kNew");
const kAssigned = document.getElementById("kAssigned");
const kProg = document.getElementById("kProg");
const kReview = document.getElementById("kReview"); // New
const kDone = document.getElementById("kDone");
const emergencyPaymentsList = document.getElementById("emergencyPaymentsList");
const emergencyPaymentsRefreshBtn = document.getElementById("emergencyPaymentsRefreshBtn");
const proAuditBody = document.getElementById("proAuditBody");
const proAuditEmployeeFilter = document.getElementById("proAuditEmployeeFilter");
const proAuditActionFilter = document.getElementById("proAuditActionFilter");
const proAuditFromDate = document.getElementById("proAuditFromDate");
const proAuditToDate = document.getElementById("proAuditToDate");
const proAuditLimit = document.getElementById("proAuditLimit");
const proAuditPrevBtn = document.getElementById("proAuditPrevBtn");
const proAuditNextBtn = document.getElementById("proAuditNextBtn");
const proAuditPageInfo = document.getElementById("proAuditPageInfo");
const proAuditSummary = document.getElementById("proAuditSummary");
const proAuditRefreshBtn = document.getElementById("proAuditRefreshBtn");
const brandDisplayNameInput = document.getElementById("brandDisplayName");
const brandLegalNameInput = document.getElementById("brandLegalName");
const brandTaglineInput = document.getElementById("brandTagline");
const brandPhoneInput = document.getElementById("brandPhone");
const brandWhatsappNumberInput = document.getElementById("brandWhatsappNumber");
const brandWhatsappTestToInput = document.getElementById("brandWhatsappTestTo");
const brandTelegramTestToInput = document.getElementById("brandTelegramTestTo");
const brandEmailInput = document.getElementById("brandEmail");
const brandEinInput = document.getElementById("brandEin");
const brandAddressInput = document.getElementById("brandAddress");
const brandLogoUrlInput = document.getElementById("brandLogoUrl");
const brandBackgroundTargetInput = document.getElementById("brandBackgroundTarget");
const brandBackgroundFitInput = document.getElementById("brandBackgroundFit");
const brandBackgroundUrlInput = document.getElementById("brandBackgroundUrl");
const brandEstimateTitleInput = document.getElementById("brandEstimateTitle");
const brandEstimateNotesInput = document.getElementById("brandEstimateNotes");
const brandLogoFileInput = document.getElementById("brandLogoFile");
const brandBackgroundFileInput = document.getElementById("brandBackgroundFile");
const brandLogoFileHint = document.getElementById("brandLogoFileHint");
const brandBackgroundFileHint = document.getElementById("brandBackgroundFileHint");
const brandAddCategoryBtn = document.getElementById("brandAddCategoryBtn");
const brandCategoryList = document.getElementById("brandCategoryList");
const brandLogoPreview = document.getElementById("brandLogoPreview");
const brandBackgroundPreview = document.getElementById("brandBackgroundPreview");
const brandSaveBtn = document.getElementById("brandSaveBtn");
const brandResetBtn = document.getElementById("brandResetBtn");
const brandStatus = document.getElementById("brandStatus");
const notifyWhatsAppTransportInput = document.getElementById("notifyWhatsAppTransport");
const notifyWhatsAppWebhookUrlInput = document.getElementById("notifyWhatsAppWebhookUrl");
const notifyWhatsAppWebhookTokenInput = document.getElementById("notifyWhatsAppWebhookToken");
const notifyWhatsAppWebhookTokenHint = document.getElementById("notifyWhatsAppWebhookTokenHint");
const notifyWhatsAppUseInternalWebhookBtn = document.getElementById("notifyWhatsAppUseInternalWebhookBtn");
const notifyWhatsAppInternalWebhookHint = document.getElementById("notifyWhatsAppInternalWebhookHint");
const notifyTwilioAccountSidInput = document.getElementById("notifyTwilioAccountSid");
const notifyTwilioAuthTokenInput = document.getElementById("notifyTwilioAuthToken");
const notifyTwilioAuthTokenHint = document.getElementById("notifyTwilioAuthTokenHint");
const notifyTwilioWhatsAppFromInput = document.getElementById("notifyTwilioWhatsAppFrom");
const notifyTwilioMessagingServiceSidInput = document.getElementById("notifyTwilioMessagingServiceSid");
const notifyTwilioStatusCallbackUrlInput = document.getElementById("notifyTwilioStatusCallbackUrl");
const notifyTelegramTransportInput = document.getElementById("notifyTelegramTransport");
const notifyTelegramBotTokenInput = document.getElementById("notifyTelegramBotToken");
const notifyTelegramBotTokenHint = document.getElementById("notifyTelegramBotTokenHint");
const notifyTelegramDefaultChatIdInput = document.getElementById("notifyTelegramDefaultChatId");
const notifySaveBtn = document.getElementById("notifySaveBtn");
const notifyConfigureBtn = document.getElementById("notifyConfigureBtn");
const notifyResetBtn = document.getElementById("notifyResetBtn");
const notifyStatus = document.getElementById("notifyStatus");
const notifyProductionSummary = document.getElementById("notifyProductionSummary");
const brandWhatsappStatusBtn = document.getElementById("brandWhatsappStatusBtn");
const brandWhatsappTestBtn = document.getElementById("brandWhatsappTestBtn");
const brandWhatsappHealth = document.getElementById("brandWhatsappHealth");
const notifyWhatsAppReadyBadge = document.getElementById("notifyWhatsAppReadyBadge");
const brandTelegramStatusBtn = document.getElementById("brandTelegramStatusBtn");
const brandTelegramTestBtn = document.getElementById("brandTelegramTestBtn");
const brandTelegramHealth = document.getElementById("brandTelegramHealth");
const notifyTelegramReadyBadge = document.getElementById("notifyTelegramReadyBadge");
const notifyWhatsAppTransportGroups = Array.from(document.querySelectorAll("[data-whatsapp-transport-group]"));
const notifyTelegramTransportGroups = Array.from(document.querySelectorAll("[data-telegram-transport-group]"));
const dashboardRefreshAllBtn = document.getElementById("dashboardRefreshAllBtn");
const dashboardToggleSectionsBtn = document.getElementById("dashboardToggleSectionsBtn");
const dashRealtime = document.getElementById("dashRealtime");
const dashTotalRequests = document.getElementById("dashTotalRequests");
const dashWorkingRequests = document.getElementById("dashWorkingRequests");
const dashReviewQueue = document.getElementById("dashReviewQueue");
const dashEmergencyActive = document.getElementById("dashEmergencyActive");
const dashAuditEvents = document.getElementById("dashAuditEvents");
const dashClosureRate = document.getElementById("dashClosureRate");
const dashCommissionToday = document.getElementById("dashCommissionToday");
const dashCommissionAll = document.getElementById("dashCommissionAll");
const dashAvgCommission = document.getElementById("dashAvgCommission");
const dashPendingProofs = document.getElementById("dashPendingProofs");
const dashOperationalHealth = document.getElementById("dashOperationalHealth");
const dashReviewRisk = document.getElementById("dashReviewRisk");
const dashEmployeeCoverage = document.getElementById("dashEmployeeCoverage");
const dashAuditIntensity = document.getElementById("dashAuditIntensity");
const dashCategoryDonut = document.getElementById("dashCategoryDonut");
const dashCategoryTopCount = document.getElementById("dashCategoryTopCount");
const dashCategoryTopLabel = document.getElementById("dashCategoryTopLabel");
const dashCategoryLegend = document.getElementById("dashCategoryLegend");
const dashStatusBars = document.getElementById("dashStatusBars");
const dashMatrixBody = document.getElementById("dashMatrixBody");
const dashFilterSource = document.getElementById("dashFilterSource");
const dashFilterEmployee = document.getElementById("dashFilterEmployee");
const dashFilterCategory = document.getElementById("dashFilterCategory");
const dashFilterStatus = document.getElementById("dashFilterStatus");
const dashFilterClient = document.getElementById("dashFilterClient");
const dashFilterUrgency = document.getElementById("dashFilterUrgency");
const dashFilterAmountMin = document.getElementById("dashFilterAmountMin");
const dashFilterAmountMax = document.getElementById("dashFilterAmountMax");
const dashFilterDateFrom = document.getElementById("dashFilterDateFrom");
const dashFilterDateTo = document.getElementById("dashFilterDateTo");
const dashFilterClearBtn = document.getElementById("dashFilterClearBtn");
const dashFilterResult = document.getElementById("dashFilterResult");

const BRAND_PORTAL_CARD_INPUTS = {
  client: {
    title: document.getElementById("brandPortalClientTitle"),
    description: document.getElementById("brandPortalClientDescription"),
    ctaLabel: document.getElementById("brandPortalClientCta"),
    icon: document.getElementById("brandPortalClientIcon"),
    imageUrl: document.getElementById("brandPortalClientImageUrl"),
    imageFile: document.getElementById("brandPortalClientImageFile"),
    imageHint: document.getElementById("brandPortalClientImageHint"),
  },
  employee: {
    title: document.getElementById("brandPortalEmployeeTitle"),
    description: document.getElementById("brandPortalEmployeeDescription"),
    ctaLabel: document.getElementById("brandPortalEmployeeCta"),
    icon: document.getElementById("brandPortalEmployeeIcon"),
    imageUrl: document.getElementById("brandPortalEmployeeImageUrl"),
    imageFile: document.getElementById("brandPortalEmployeeImageFile"),
    imageHint: document.getElementById("brandPortalEmployeeImageHint"),
  },
  boss: {
    title: document.getElementById("brandPortalBossTitle"),
    description: document.getElementById("brandPortalBossDescription"),
    ctaLabel: document.getElementById("brandPortalBossCta"),
    icon: document.getElementById("brandPortalBossIcon"),
    imageUrl: document.getElementById("brandPortalBossImageUrl"),
    imageFile: document.getElementById("brandPortalBossImageFile"),
    imageHint: document.getElementById("brandPortalBossImageHint"),
  },
};

let FILTER = "all";
let CURRENT_USER = null;
let CACHE = [];
let EMERGENCY_CALLS_CACHE = [];
let REVIEW_QUEUE_CACHE = [];
let REVIEW_QUEUE_LAST_ERROR = "";
let UNSUB = null;
let EMERGENCY_POLL_TIMER = null;
let AUDIT_CACHE = [];
let AUDIT_FILTERED = [];
let AUDIT_PAGE = 1;
let AUDIT_FETCH_LIMIT = 50;
const AUDIT_PAGE_SIZE = 12;
const REVIEW_QUEUE_LIMIT = 300;
let CURRENT_COMPANY_CONFIG = null;
let CURRENT_NOTIFICATION_SETTINGS = null;
let CURRENT_NOTIFICATION_CHANNELS = null;
let BRAND_BACKGROUND_DRAFTS = {};
let BRAND_CATEGORY_DRAFTS = [];
let SECTION_COLLAPSE_STATE = {};
let SECTION_COLLAPSE_BOUND = false;
let DASHBOARD_FILTER_BOUND = false;
let BOSS_NOTIFIER = null;
let REVIEW_QUEUE_NOTIFY_PRIMED = false;
let EMERGENCY_NOTIFY_PRIMED = false;
let REQUEST_NOTIFY_PRIMED = false;
let LAST_EMERGENCY_NOTIFY_STATE = new Map();
let LAST_REQUEST_NOTIFY_STATE = new Map();

const SECTION_COLLAPSE_STORAGE_KEY = "swe:boss:collapsedSections:v1";
const DASHBOARD_FILTER_STORAGE_KEY = "swe:boss:dashboardFilters:v1";

const DASHBOARD_FILTER_DEFAULTS = Object.freeze({
  source: "all",
  employee: "",
  category: "",
  status: "all",
  client: "",
  urgency: "all",
  amountMin: "",
  amountMax: "",
  dateFrom: "",
  dateTo: "",
});

const ACTIVITY_EVENTS = Object.freeze([
  "SOLICITUD_CREADA",
  "TRABAJO_ASIGNADO",
  "PROPUESTA_ENVIADA",
  "PROPUESTA_ACEPTADA",
  "TRABAJO_FINALIZADO",
  "CIERRE_CLIENTE",
  "COMPROBANTE_SUBIDO",
  "PAGO_RECHAZADO",
  "PAGO_APROBADO",
  "SOLICITUD_CANCELADA",
  "ACCION_FORZADA_JEFE",
  "CIERRE_FORZADO_JEFE"
]);

const BRAND_BACKGROUND_TARGETS = Object.freeze({
  default: "General del portal",
  hub: "Inicio",
  "login-client": "Login cliente",
  "login-employee": "Login empleado",
  "login-boss": "Login jefe",
  "panel-client": "Panel cliente",
  "panel-employee": "Panel empleado",
  "panel-boss": "Panel jefe",
  "client-requests": "Solicitudes cliente",
  "estimate-form": "Formulario de estimado",
});

let SELECTED_ID = null;

// ===== CHAT STATE =====
let CHAT_REQUEST_ID = null;
let CHAT_IS_INTERNAL = false;
let CHAT_MESSAGES = [];
let CHAT_POLL_TIMER = null;
let CHAT_LAST_SENT = 0;
let BOSS_ACTIONS_BOUND = false;

function decodeDataValue(value) {
  try {
    return decodeURIComponent(String(value || ""));
  } catch (_) {
    return String(value || "");
  }
}

function openExternalResource(rawUrl) {
  const url = String(rawUrl || "").trim();
  if (!url) return;
  window.open(url, "_blank", "noopener,noreferrer");
}

async function handleBossUiAction(action, element) {
  switch (String(action || "").trim()) {
    case "open-app-modal":
      await window.openAppModal?.();
      return;
    case "do-logout":
      await window.doLogout?.();
      return;
    case "open-standalone-estimate":
      window.openStandaloneBossEstimate?.();
      return;
    case "toggle-history":
      window.toggleHistory?.();
      return;
    case "set-filter":
      window.setFilter?.(element?.getAttribute("data-filter") || "all");
      return;
    case "close-app-modal": {
      const modal = document.getElementById("appModal");
      if (modal) modal.style.display = "none";
      return;
    }
    default:
      return;
  }
}

async function handleBossAction(action, element) {
  const requestId = decodeDataValue(element?.getAttribute("data-request-id"));

  switch (String(action || "").trim()) {
    case "approve-review-payment":
    case "reject-review-payment": {
      const container = element?.closest("[data-review-id]");
      const recordId = decodeDataValue(container?.getAttribute("data-review-id"));
      const sourceType = decodeDataValue(container?.getAttribute("data-review-source"));
      if (!recordId) return;
      if (action === "approve-review-payment") {
        if (sourceType === "emergency") await window.approveEmergencyPaymentReq?.(recordId);
        else await window.approvePaymentReq?.(recordId);
        return;
      }
      if (sourceType === "emergency") await window.rejectEmergencyPaymentReq?.(recordId);
      else await window.rejectPaymentReq?.(recordId);
      return;
    }
    case "select-request":
      window.selectRequest?.(requestId);
      return;
    case "approve-payment":
      await window.approvePaymentReq?.(requestId);
      return;
    case "reject-payment":
      await window.rejectPaymentReq?.(requestId);
      return;
    case "close-detail":
      window.closeDetail?.();
      return;
    case "open-chat":
      await window.openChat?.(requestId, element?.getAttribute("data-chat-internal") === "1");
      return;
    case "prepare-estimate":
      window.prepareBossEstimate?.(requestId);
      return;
    case "cancel-request":
      await window.cancelByBoss?.(requestId);
      return;
    case "force-release":
      await window.forceRelease?.(requestId);
      return;
    case "force-done":
      await window.forceDone?.(requestId);
      return;
    case "delete-audit-event":
      await window.deleteAuditEvent?.(decodeDataValue(element?.getAttribute("data-event-id")));
      return;
    case "open-image":
      openExternalResource(element?.getAttribute("data-open-url"));
      return;
    case "approve-app":
      await window.approveApp?.(decodeDataValue(element?.getAttribute("data-application-id")));
      return;
    case "reject-app":
      await window.rejectApp?.(decodeDataValue(element?.getAttribute("data-application-id")));
      return;
    case "approve-photo-change":
      await window.approvePhotoChange?.(decodeDataValue(element?.getAttribute("data-photo-change-id")));
      return;
    case "reject-photo-change":
      await window.rejectPhotoChange?.(decodeDataValue(element?.getAttribute("data-photo-change-id")));
      return;
    default:
      return;
  }
}

function bindBossDelegatedActions() {
  if (BOSS_ACTIONS_BOUND) return;
  BOSS_ACTIONS_BOUND = true;

  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;

    const uiElement = event.target.closest("[data-boss-ui-action]");
    if (uiElement) {
      event.preventDefault();
      void handleBossUiAction(uiElement.getAttribute("data-boss-ui-action"), uiElement);
      return;
    }

    const actionElement = event.target.closest("[data-boss-action]");
    if (!actionElement) return;

    event.preventDefault();
    void handleBossAction(actionElement.getAttribute("data-boss-action"), actionElement);
  });

  document.addEventListener("keydown", (event) => {
    if (!(event.target instanceof Element)) return;
    if (event.key !== "Enter" && event.key !== " ") return;

    const interactive = event.target.closest("[data-boss-ui-action], [data-boss-action]");
    if (!interactive) return;
    if (interactive.tagName === "BUTTON" || interactive.tagName === "A") return;

    event.preventDefault();
    if (interactive.hasAttribute("data-boss-ui-action")) {
      void handleBossUiAction(interactive.getAttribute("data-boss-ui-action"), interactive);
      return;
    }
    void handleBossAction(interactive.getAttribute("data-boss-action"), interactive);
  });
}

bindBossDelegatedActions();
let CHAT_CAN_SEND = true;
let CHAT_SEND_REASON = "";
const CHAT_ALLOWED_STATUSES = [
  "ASIGNADO",
  "NEGOCIANDO",
  "EN_PROCESO",
  "ESPERANDO_CIERRE_CLIENTE"
];
const EMPLOYEE_NAME_CACHE = new Map();
const EMPLOYEE_NAME_PENDING = new Set();

function getEmployeeUid(source = {}) {
  const uid = source.assignedEmployeeId || source.employeeId || source.uid || "";
  return String(uid || "").trim();
}

function normalizeName(value) {
  return String(value || "").trim();
}

function normalizeEmergencyStatusForBoss(status) {
  const value = String(status || "").trim().toLowerCase();
  if (value === "payment_pending_review") return "PAGO_PENDIENTE_REVISION";
  if (value === "awaiting_payment_proof") return "ESPERANDO_COMPROBANTE_PAGO";
  if (value === "awaiting_client_close") return "ESPERANDO_CIERRE_CLIENTE";
  if (value === "accepted") return "EN_PROCESO";
  if (value === "completed") return "COMPLETADO";
  if (value === "pending") return "EN_ESPERA";
  return value.toUpperCase() || "EN_ESPERA";
}

function getEmployeeDisplayName(source = {}) {
  const explicitName = normalizeName(source.employeeName || source.displayName || source.name);
  if (explicitName) return explicitName;

  const uid = getEmployeeUid(source);
  const cachedName = uid ? normalizeName(EMPLOYEE_NAME_CACHE.get(uid)) : "";
  if (cachedName) return cachedName;

  const email = normalizeName(source.employeeEmail || source.email);
  if (email) return email;

  return uid ? `${uid.slice(0, 8)}...` : "Empleado";
}

function toMillis(rawValue) {
  if (rawValue == null) return 0;
  if (typeof rawValue === "number") return Number.isFinite(rawValue) ? rawValue : 0;
  if (typeof rawValue === "string") {
    const asNumber = Number(rawValue);
    if (Number.isFinite(asNumber) && asNumber > 0) return asNumber;
    const asDate = Date.parse(rawValue);
    return Number.isFinite(asDate) ? asDate : 0;
  }
  if (rawValue instanceof Date) return rawValue.getTime();
  if (typeof rawValue?.toMillis === "function") {
    const ms = Number(rawValue.toMillis());
    return Number.isFinite(ms) ? ms : 0;
  }
  if (typeof rawValue?.toDate === "function") {
    const date = rawValue.toDate();
    return date instanceof Date ? date.getTime() : 0;
  }
  if (typeof rawValue?.seconds === "number") {
    return Number(rawValue.seconds) * 1000;
  }
  return 0;
}

function initBossNotifier() {
  if (BOSS_NOTIFIER) return BOSS_NOTIFIER;
  BOSS_NOTIFIER = createNotifier({
    title: "Centro de alertas jefe",
    bellLabel: "Alertas",
    position: "top-right",
    storageKey: "swe:boss:notify:seen:v1",
    historyStorageKey: "swe:electric:web:notify:history:v1",
    typeOptions: {
      payments: "Pagos",
      emergencies: "Emergencias",
      requests: "Solicitudes",
      audit: "Auditoria",
    },
    onItemAction: handleBossNotificationAction,
    maxItems: 40,
    toastMs: 5200,
    sounds: true,
  });
  return BOSS_NOTIFIER;
}

function notifyBoss(payload = {}) {
  const notifier = initBossNotifier();
  if (!notifier) return false;
  return notifier.notify(payload);
}

function rememberBossKeys(keys = []) {
  const notifier = initBossNotifier();
  if (!notifier) return;
  notifier.rememberKeys(keys);
}

function flashElement(element, duration = 2200) {
  if (!(element instanceof HTMLElement)) return;
  const prevTransition = element.style.transition;
  const prevBoxShadow = element.style.boxShadow;
  const prevOutline = element.style.outline;
  element.style.transition = "box-shadow 180ms ease, outline-color 180ms ease";
  element.style.outline = "2px solid rgba(96,165,250,0.85)";
  element.style.boxShadow = "0 0 0 2px rgba(96,165,250,0.35), 0 14px 30px rgba(2,8,23,0.55)";
  window.setTimeout(() => {
    element.style.transition = prevTransition;
    element.style.boxShadow = prevBoxShadow;
    element.style.outline = prevOutline;
  }, duration);
}

function ensureBossSectionVisible(cardId) {
  const card = document.getElementById(cardId);
  if (!card) return null;
  if (card.classList.contains("is-collapsed")) {
    setSectionCollapsed(card, false);
  }
  card.scrollIntoView({ behavior: "smooth", block: "start" });
  flashElement(card);
  return card;
}

function mapStatusToFilter(status) {
  const st = String(status || "").toUpperCase();
  if (["ESPERANDO_COMPROBANTE_PAGO", "PAGO_PENDIENTE_REVISION"].includes(st)) return "review";
  if (st === "EN_ESPERA") return "new";
  if (["ASIGNADO", "NEGOCIANDO"].includes(st)) return "assigned";
  if (["EN_PROCESO", "ESPERANDO_CIERRE_CLIENTE"].includes(st)) return "in_progress";
  if (["COMPLETADO", "CANCELADO"].includes(st)) return "done";
  return "all";
}

function focusBossRequest(requestId) {
  const id = normalizeName(requestId);
  if (!id) return false;
  const row = CACHE.find((entry) => normalizeName(entry?.id) === id);
  if (!row) return false;

  const targetFilter = mapStatusToFilter(row?.data?.status);
  if (targetFilter && FILTER !== targetFilter) {
    FILTER = targetFilter;
    highlightFilter();
  }

  SELECTED_ID = id;
  renderList();
  renderDetail();

  const idAttr = encodeURIComponent(id);
  const card = document.querySelector(`.mini-card[data-request-id="${idAttr}"]`);
  if (card) {
    card.scrollIntoView({ behavior: "smooth", block: "nearest" });
    flashElement(card);
  }

  const detailView = document.getElementById("detailView");
  if (detailView && detailView.style.display !== "none") {
    detailView.scrollIntoView({ behavior: "smooth", block: "start" });
    flashElement(detailView);
  }
  return true;
}

function focusBossReviewQueueItem(sourceType, recordId) {
  const source = normalizeName(sourceType || "").toLowerCase() === "emergency" ? "emergency" : "request";
  const record = normalizeName(recordId);
  if (!record) return false;
  ensureBossSectionVisible("emergencyPaymentsCard");
  const sourceAttr = encodeURIComponent(source);
  const recordAttr = encodeURIComponent(record);
  const selector = `[data-review-source="${sourceAttr}"][data-review-id="${recordAttr}"]`;
  const target = document.querySelector(selector);
  if (!target) return false;
  target.scrollIntoView({ behavior: "smooth", block: "center" });
  flashElement(target, 2600);
  return true;
}

function handleBossNotificationAction(payload = {}) {
  const action = payload?.action || {};
  const kind = normalizeName(action.kind).toLowerCase();
  if (!kind) return;

  if (kind === "open-request") {
    if (focusBossRequest(action.requestId)) return;
  }

  if (kind === "open-request-chat") {
    const requestId = normalizeName(action.requestId);
    if (!requestId) return;
    focusBossRequest(requestId);
    const isInternal = String(action.chatMode || "").toLowerCase() === "internal";
    Promise.resolve(window.openChat(requestId, isInternal)).catch(() => {});
    return;
  }

  if (kind === "open-review-queue") {
    if (focusBossReviewQueueItem(action.sourceType, action.recordId)) return;
    ensureBossSectionVisible("emergencyPaymentsCard");
    return;
  }

  if (kind === "open-emergency-page") {
    const callId = normalizeName(action.callId || action.recordId);
    const wantsChat = Boolean(action.openChat);
    const params = new URLSearchParams();
    if (callId) params.set("focusId", callId);
    if (wantsChat) params.set("openChat", "1");
    const target = params.toString() ? `emergency.html?${params.toString()}` : "emergency.html";
    window.location.href = target;
  }
}

function buildReviewQueueNotifyKey(row = {}) {
  const sourceType = normalizeName(row.sourceType || "request").toLowerCase() || "request";
  const recordId = normalizeName(row.recordId || row.id || "");
  const proofTs = toMillis(row.proofDateRaw || row.paymentProofAt || row.paymentProofAtMs);
  const amount = Number(row.amount || 0).toFixed(2);
  return `boss:review:${sourceType}:${recordId}:${proofTs}:${amount}`;
}

function processReviewQueueNotifications(rows = []) {
  const normalizedRows = (Array.isArray(rows) ? rows : [])
    .map((row) => normalizeReviewQueueRow(row))
    .filter((row) => Boolean(row.recordId));
  const keys = normalizedRows.map((row) => buildReviewQueueNotifyKey(row));

  if (!REVIEW_QUEUE_NOTIFY_PRIMED) {
    rememberBossKeys(keys);
    REVIEW_QUEUE_NOTIFY_PRIMED = true;
    return;
  }

  const notifier = initBossNotifier();
  normalizedRows.forEach((row, index) => {
    const dedupeKey = keys[index];
    if (!dedupeKey || notifier.isSeen(dedupeKey)) return;
    const amount = Number(row.amount || 0);
    const deposit = Number.isFinite(amount) ? Math.round(amount * BOSS_COMMISSION_RATE * 100) / 100 : 0;
    notifyBoss({
      dedupeKey,
      type: "payments",
      priority: "high",
      tone: "warning",
      title: "Nuevo comprobante por revisar",
      message: `${row.employeeName || "Empleado"} envio pago (${row.sourceLabel || "Solicitud"} ${row.recordId}). Deposito esperado: ${formatCurrency(deposit)}.`,
      action: row.sourceType === "request"
        ? {
          kind: "open-request-chat",
          requestId: row.recordId,
          chatMode: "internal",
        }
        : {
          kind: "open-emergency-page",
          callId: row.recordId,
          openChat: true,
        },
      toast: true,
    });
  });
}

function buildEmergencyNotifySnapshot(call = {}) {
  const callId = normalizeName(call.id || call.requestId || "");
  const status = normalizeName(call.status).toLowerCase();
  const updatedTs = toMillis(call.updatedAtMs || call.updatedAt || call.createdAtMs || call.createdAt);
  const key = `boss:emergency:${callId}:${status}:${updatedTs}`;
  return { callId, status, updatedTs, key };
}

function processEmergencyNotifications(calls = []) {
  const rows = Array.isArray(calls) ? calls : [];
  const nextState = new Map();

  rows.forEach((call) => {
    const snap = buildEmergencyNotifySnapshot(call);
    if (!snap.callId) return;
    nextState.set(snap.callId, snap);
  });

  if (!EMERGENCY_NOTIFY_PRIMED) {
    rememberBossKeys(Array.from(nextState.values()).map((entry) => entry.key));
    LAST_EMERGENCY_NOTIFY_STATE = nextState;
    EMERGENCY_NOTIFY_PRIMED = true;
    return;
  }

  rows.forEach((call) => {
    const snap = buildEmergencyNotifySnapshot(call);
    if (!snap.callId) return;
    const prev = LAST_EMERGENCY_NOTIFY_STATE.get(snap.callId);
    const isNewEmergency = !prev;
    const becamePending = prev && prev.status !== "pending" && snap.status === "pending";
    if (!(isNewEmergency || becamePending) || snap.status !== "pending") return;

    notifyBoss({
      dedupeKey: snap.key,
      type: "emergencies",
      priority: "medium",
      tone: "info",
      title: "Nueva emergencia entrante",
      message: `${call.clientName || call.clientEmail || "Cliente"} reporto emergencia en ${call.location || "ubicacion no indicada"}.`,
      action: {
        kind: "open-emergency-page",
        callId: snap.callId,
        openChat: false,
      },
      toast: true,
    });
  });

  LAST_EMERGENCY_NOTIFY_STATE = nextState;
}

function buildRequestNotifySnapshot(entry = {}) {
  const id = normalizeName(entry?.id || "");
  const req = entry?.data || {};
  const status = normalizeName(req.status).toUpperCase();
  const updatedTs = toMillis(req.updatedAt || req.createdAt || req.paymentProofAt || req.paymentProofAtMs);
  const key = `boss:request:${id}:${status}:${updatedTs}`;
  return { id, status, updatedTs, key, req };
}

function processRequestNotifications(items = []) {
  const rows = Array.isArray(items) ? items : [];
  const nextState = new Map();

  rows.forEach((entry) => {
    const snap = buildRequestNotifySnapshot(entry);
    if (!snap.id) return;
    nextState.set(snap.id, snap);
  });

  if (!REQUEST_NOTIFY_PRIMED) {
    rememberBossKeys(Array.from(nextState.values()).map((entry) => entry.key));
    LAST_REQUEST_NOTIFY_STATE = nextState;
    REQUEST_NOTIFY_PRIMED = true;
    return;
  }

  rows.forEach((entry) => {
    const snap = buildRequestNotifySnapshot(entry);
    if (!snap.id) return;
    const prev = LAST_REQUEST_NOTIFY_STATE.get(snap.id);
    const isNewRequest = !prev && snap.status === "EN_ESPERA";
    const reopenedToPending = prev && prev.status !== "EN_ESPERA" && snap.status === "EN_ESPERA";
    if (!isNewRequest && !reopenedToPending) return;

    const req = snap.req || {};
    notifyBoss({
      dedupeKey: snap.key,
      type: "requests",
      priority: "medium",
      tone: "info",
      title: "Nueva solicitud de cliente",
      message: `${req.clientNickname || req.clientEmail || "Cliente"} envio solicitud en ${req.category || "General"}.`,
      action: {
        kind: "open-request-chat",
        requestId: snap.id,
        chatMode: "public",
      },
      toast: true,
    });
  });

  LAST_REQUEST_NOTIFY_STATE = nextState;
}

async function fetchEmployeeName(uid) {
  const cleanUid = normalizeName(uid);
  if (!cleanUid) return;
  if (EMPLOYEE_NAME_CACHE.has(cleanUid) || EMPLOYEE_NAME_PENDING.has(cleanUid)) return;

  EMPLOYEE_NAME_PENDING.add(cleanUid);
  try {
    const res = await apiFetch(`/api/employees/${cleanUid}/profile`);
    const name = normalizeName(res?.data?.name || res?.data?.displayName || res?.data?.email);
    if (name) {
      EMPLOYEE_NAME_CACHE.set(cleanUid, name);
    }
  } catch (_) {
    // Keep silent: fallback chain (email/uid) is still available in UI.
  } finally {
    EMPLOYEE_NAME_PENDING.delete(cleanUid);
  }
}

async function ensureEmployeeNames(sources = []) {
  const uids = Array.from(new Set(
    (Array.isArray(sources) ? sources : [])
      .map((source) => getEmployeeUid(source))
      .filter((uid) => uid && !EMPLOYEE_NAME_CACHE.has(uid))
  ));

  if (!uids.length) return;
  await Promise.all(uids.map((uid) => fetchEmployeeName(uid)));
}

window.setFilter = (f) => {
  FILTER = f;
  SELECTED_ID = null; // Reset selection on filter change
  highlightFilter();
  renderList();
  renderDetail();
};

window.reloadNow = () => {
  startRealtime(true);
  fetchEmergencyCalls({ silent: false }).catch(() => {});
  fetchReviewQueue({ silent: false }).catch(() => {});
};
window.goHome = () => { window.location.href = "index.html"; };
window.doLogout = async () => {
  try {
    await clearPortalSession({ revoke: true });
    stopEmergencyPolling();
    await signOut(auth);
    window.location.href = "index.html";
  } catch (e) { console.error("Logout error", e); }
};
window.selectRequest = (id) => {
  SELECTED_ID = id;
  renderList();
  renderDetail();
  // Mobile Support
  if (window.innerWidth <= 900) {
    const panel = document.getElementById("detailPanel");
    if (panel) {
      panel.classList.add("visible");
      panel.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }
};
window.closeDetail = () => {
  SELECTED_ID = null;
  const panel = document.getElementById("detailPanel");
  if (panel) panel.classList.remove("visible");
  renderList();
  renderDetail();
};

window.logoutBoss = async () => {
  await clearPortalSession({ revoke: true });
  stopEmergencyPolling();
  try { await signOut(auth); } catch (e) { }
  window.location.href = "login-jefe.html";
};

async function isBossUser(user) {
  if (!user) return false;
  const email = String(user.email || "").toLowerCase();
  if (BOSS_EMAILS.includes(email)) return true;

  try {
    const tokenResult = await getIdTokenResult(user, false);
    const roleFromClaims = String(tokenResult?.claims?.role || "").toLowerCase();
    if (roleFromClaims === "boss") return true;
  } catch (_) {
    // ignore token errors and fallback to users doc
  }

  try {
    const profileSnap = await getDoc(doc(db, "users", user.uid));
    const profileRole = String(profileSnap.data()?.role || "").toLowerCase();
    if (profileRole === "boss") return true;
  } catch (_) {
    // ignore profile lookup failures
  }

  return false;
}

function escapeHtml(s = "") {
  return String(s).replace(/[&<>"']/g, m => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[m]));
}

function fmtDate(ts) {
  try {
    if (!ts) return "—";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString();
  } catch { return "—"; }
}

function highlightFilter() {
  document.querySelectorAll("[data-filter]").forEach(b => {
    b.classList.toggle("active", b.getAttribute("data-filter") === FILTER);
  });
}

function canSee(data) {
  const st = String(data.status || "EN_ESPERA").toUpperCase();
  if (FILTER === "all") return true;

  // Map filter to statuses
  if (FILTER === "review" && ["ESPERANDO_COMPROBANTE_PAGO", "PAGO_PENDIENTE_REVISION"].includes(st)) return true;
  if (FILTER === "new" && st === "EN_ESPERA") return true;
  if (FILTER === "assigned" && ["ASIGNADO", "NEGOCIANDO"].includes(st)) return true;
  if (FILTER === "in_progress" && ["EN_PROCESO", "ESPERANDO_CIERRE_CLIENTE"].includes(st)) return true;
  if (FILTER === "done" && ["COMPLETADO", "CANCELADO"].includes(st)) return true;

  return false;
}

function isEmergencyActiveStatus(status) {
  const value = String(status || "").trim().toLowerCase();
  return ![
    "completed",
    "cancelled",
    "canceled",
    "rejected",
    "closed",
    "resolved"
  ].includes(value);
}

function computeRequestCounters() {
  const counts = {
    total: CACHE.length,
    new: 0,
    assigned: 0,
    in_progress: 0,
    done: 0,
    review: 0,
    emergencyPendingReview: 0,
    emergencyActive: 0,
  };

  CACHE.forEach((entry) => {
    const st = String(entry?.data?.status || "EN_ESPERA").toUpperCase();

    if (["ESPERANDO_COMPROBANTE_PAGO", "PAGO_PENDIENTE_REVISION"].includes(st)) {
      counts.review++;
    } else if (st === "EN_ESPERA") {
      counts.new++;
    } else if (["ASIGNADO", "NEGOCIANDO"].includes(st)) {
      counts.assigned++;
    } else if (["COMPLETADO", "CANCELADO"].includes(st)) {
      counts.done++;
    } else {
      counts.in_progress++;
    }
  });

  counts.emergencyPendingReview = EMERGENCY_CALLS_CACHE.filter(
    (call) => String(call?.status || "").toLowerCase() === "payment_pending_review"
  ).length;
  counts.emergencyActive = EMERGENCY_CALLS_CACHE.filter(
    (call) => isEmergencyActiveStatus(call?.status)
  ).length;
  counts.review += counts.emergencyPendingReview;

  return counts;
}

function refreshKPIs() {
  const counts = computeRequestCounters();

  if (kNew) kNew.textContent = counts.new;
  if (kAssigned) kAssigned.textContent = counts.assigned;
  if (kProg) kProg.textContent = counts.in_progress;
  if (kReview) kReview.textContent = counts.review;
  if (kDone) kDone.textContent = counts.done;

  return counts;
}

function readSectionCollapseState() {
  try {
    const raw = localStorage.getItem(SECTION_COLLAPSE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (_) {
    return {};
  }
}

function persistSectionCollapseState() {
  try {
    localStorage.setItem(SECTION_COLLAPSE_STORAGE_KEY, JSON.stringify(SECTION_COLLAPSE_STATE));
  } catch (_) {
    // ignore storage errors
  }
}

function updateDashboardSectionToggleButton() {
  if (!dashboardToggleSectionsBtn) return;
  const cards = Array.from(document.querySelectorAll(".collapsible-card"));
  if (!cards.length) return;
  const allCollapsed = cards.every((card) => card.classList.contains("is-collapsed"));
  dashboardToggleSectionsBtn.textContent = allCollapsed ? "Expandir secciones" : "Minimizar secciones";
}

function setSectionCollapsed(card, collapsed, { persist = true } = {}) {
  if (!card) return;
  const body = card.querySelector(".collapsible-body");
  const toggleBtn = card.querySelector("[data-collapse-btn]");
  if (!body || !toggleBtn) return;

  card.classList.toggle("is-collapsed", !!collapsed);
  body.hidden = !!collapsed;
  toggleBtn.textContent = collapsed ? "Expandir" : "Minimizar";
  toggleBtn.setAttribute("aria-expanded", collapsed ? "false" : "true");

  if (persist && card.id) {
    SECTION_COLLAPSE_STATE[card.id] = !!collapsed;
    persistSectionCollapseState();
  }

  updateDashboardSectionToggleButton();
}

function bindCollapsibleSections() {
  if (SECTION_COLLAPSE_BOUND) return;
  SECTION_COLLAPSE_BOUND = true;
  SECTION_COLLAPSE_STATE = readSectionCollapseState();

  const cards = Array.from(document.querySelectorAll(".collapsible-card"));
  cards.forEach((card) => {
    const toggleBtn = card.querySelector("[data-collapse-btn]");
    if (!toggleBtn) return;

    const hasSavedState = Boolean(card.id) && Object.prototype.hasOwnProperty.call(SECTION_COLLAPSE_STATE, card.id);
    const defaultCollapsed = String(card.dataset.defaultCollapsed || "true").toLowerCase() === "true";
    const forceDefaultCollapsed = String(card.dataset.forceDefaultCollapsed || "false").toLowerCase() === "true";
    const shouldCollapse = forceDefaultCollapsed
      ? defaultCollapsed
      : (hasSavedState ? Boolean(SECTION_COLLAPSE_STATE[card.id]) : defaultCollapsed);
    setSectionCollapsed(card, shouldCollapse, { persist: false });

    toggleBtn.addEventListener("click", () => {
      const isCollapsed = card.classList.contains("is-collapsed");
      setSectionCollapsed(card, !isCollapsed);
    });
  });

  dashboardRefreshAllBtn?.addEventListener("click", () => {
    window.reloadNow();
  });

  dashboardToggleSectionsBtn?.addEventListener("click", () => {
    const sectionCards = Array.from(document.querySelectorAll(".collapsible-card"));
    const hasExpanded = sectionCards.some((card) => !card.classList.contains("is-collapsed"));
    sectionCards.forEach((card) => {
      setSectionCollapsed(card, hasExpanded);
    });
  });

  updateDashboardSectionToggleButton();
}

function readDashboardFiltersFromStorage() {
  try {
    const raw = localStorage.getItem(DASHBOARD_FILTER_STORAGE_KEY);
    if (!raw) return { ...DASHBOARD_FILTER_DEFAULTS };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return { ...DASHBOARD_FILTER_DEFAULTS };
    return {
      ...DASHBOARD_FILTER_DEFAULTS,
      source: normalizeName(parsed.source) || DASHBOARD_FILTER_DEFAULTS.source,
      employee: normalizeName(parsed.employee),
      category: normalizeName(parsed.category),
      status: normalizeName(parsed.status) || DASHBOARD_FILTER_DEFAULTS.status,
      client: normalizeName(parsed.client),
      urgency: normalizeName(parsed.urgency) || DASHBOARD_FILTER_DEFAULTS.urgency,
      amountMin: normalizeName(parsed.amountMin),
      amountMax: normalizeName(parsed.amountMax),
      dateFrom: normalizeName(parsed.dateFrom),
      dateTo: normalizeName(parsed.dateTo),
    };
  } catch (_) {
    return { ...DASHBOARD_FILTER_DEFAULTS };
  }
}

function persistDashboardFilters(filters = {}) {
  try {
    localStorage.setItem(DASHBOARD_FILTER_STORAGE_KEY, JSON.stringify({
      source: normalizeName(filters.source || "all"),
      employee: normalizeName(filters.employee),
      category: normalizeName(filters.category),
      status: normalizeName(filters.status || "all"),
      client: normalizeName(filters.client),
      urgency: normalizeName(filters.urgency || "all"),
      amountMin: normalizeName(filters.amountMin),
      amountMax: normalizeName(filters.amountMax),
      dateFrom: normalizeName(filters.dateFrom),
      dateTo: normalizeName(filters.dateTo),
    }));
  } catch (_) {
    // ignore storage errors
  }
}

function applyDashboardFilterState(state = {}) {
  if (dashFilterSource) dashFilterSource.value = normalizeName(state.source || DASHBOARD_FILTER_DEFAULTS.source) || "all";
  if (dashFilterEmployee) dashFilterEmployee.value = normalizeName(state.employee);
  if (dashFilterCategory) dashFilterCategory.value = normalizeName(state.category);
  if (dashFilterStatus) dashFilterStatus.value = normalizeName(state.status || DASHBOARD_FILTER_DEFAULTS.status) || "all";
  if (dashFilterClient) dashFilterClient.value = normalizeName(state.client);
  if (dashFilterUrgency) dashFilterUrgency.value = normalizeName(state.urgency || DASHBOARD_FILTER_DEFAULTS.urgency) || "all";
  if (dashFilterAmountMin) dashFilterAmountMin.value = normalizeName(state.amountMin);
  if (dashFilterAmountMax) dashFilterAmountMax.value = normalizeName(state.amountMax);
  if (dashFilterDateFrom) dashFilterDateFrom.value = normalizeName(state.dateFrom);
  if (dashFilterDateTo) dashFilterDateTo.value = normalizeName(state.dateTo);
}

function readDashboardFiltersFromDOM() {
  return {
    source: normalizeName(dashFilterSource?.value || "all") || "all",
    employee: normalizeName(dashFilterEmployee?.value || ""),
    category: normalizeName(dashFilterCategory?.value || ""),
    status: normalizeName(dashFilterStatus?.value || "all") || "all",
    client: normalizeName(dashFilterClient?.value || ""),
    urgency: normalizeName(dashFilterUrgency?.value || "all") || "all",
    amountMin: normalizeName(dashFilterAmountMin?.value || ""),
    amountMax: normalizeName(dashFilterAmountMax?.value || ""),
    dateFrom: normalizeName(dashFilterDateFrom?.value || ""),
    dateTo: normalizeName(dashFilterDateTo?.value || ""),
  };
}

function syncDashboardSelectOptions(selectEl, values, defaultLabel = "Todos") {
  if (!selectEl) return;
  const previous = normalizeName(selectEl.value);
  const list = Array.from(new Set((Array.isArray(values) ? values : []).filter(Boolean))).sort((a, b) => a.localeCompare(b));

  const options = [`<option value="">${escapeHtml(defaultLabel)}</option>`];
  list.forEach((value) => {
    options.push(`<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`);
  });
  selectEl.innerHTML = options.join("");
  selectEl.value = list.includes(previous) ? previous : "";
}

function syncDashboardMappedOptions(selectEl, entries, defaultLabel = "Todos") {
  if (!selectEl) return;
  const previous = normalizeName(selectEl.value || selectEl.dataset.pendingValue || "");
  const map = new Map();

  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    const value = normalizeName(entry?.value);
    const label = normalizeName(entry?.label) || value;
    if (!value) return;
    if (!map.has(value)) map.set(value, label);
  });

  const options = [`<option value="">${escapeHtml(defaultLabel)}</option>`];
  Array.from(map.entries())
    .sort((a, b) => a[1].localeCompare(b[1]))
    .forEach(([value, label]) => {
      options.push(`<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`);
    });

  selectEl.innerHTML = options.join("");
  selectEl.value = map.has(previous) ? previous : "";
}

function bindDashboardFilterEvents() {
  if (DASHBOARD_FILTER_BOUND) return;
  DASHBOARD_FILTER_BOUND = true;

  const persisted = readDashboardFiltersFromStorage();
  applyDashboardFilterState(persisted);
  if (dashFilterEmployee && persisted.employee) dashFilterEmployee.dataset.pendingValue = persisted.employee;
  if (dashFilterCategory && persisted.category) dashFilterCategory.dataset.pendingValue = persisted.category;
  if (dashFilterClient && persisted.client) dashFilterClient.dataset.pendingValue = persisted.client;

  const onChange = () => {
    const filters = readDashboardFiltersFromDOM();
    persistDashboardFilters(filters);
    renderSystemDashboard();
  };

  dashFilterSource?.addEventListener("change", onChange);
  dashFilterEmployee?.addEventListener("change", onChange);
  dashFilterCategory?.addEventListener("change", onChange);
  dashFilterStatus?.addEventListener("change", onChange);
  dashFilterClient?.addEventListener("change", onChange);
  dashFilterUrgency?.addEventListener("change", onChange);
  dashFilterAmountMin?.addEventListener("input", onChange);
  dashFilterAmountMax?.addEventListener("input", onChange);
  dashFilterDateFrom?.addEventListener("change", onChange);
  dashFilterDateTo?.addEventListener("change", onChange);

  dashFilterClearBtn?.addEventListener("click", () => {
    applyDashboardFilterState(DASHBOARD_FILTER_DEFAULTS);
    persistDashboardFilters(DASHBOARD_FILTER_DEFAULTS);
    renderSystemDashboard();
  });
}

function computeCommissionTotals(history = []) {
  const rows = Array.isArray(history) ? history : [];
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const todayTotal = rows.reduce((sum, item) => {
    const date = normalizeAuditDate(item?.createdAt);
    return (date && date >= startOfToday) ? sum + Number(item?.commissionAmount || 0) : sum;
  }, 0);
  const allTotal = rows.reduce((sum, item) => sum + Number(item?.commissionAmount || 0), 0);

  return { todayTotal, allTotal };
}

function formatCurrency(value) {
  const amount = Number(value || 0);
  return `$${amount.toLocaleString()}`;
}

function formatPercent(value, digits = 1) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return "0%";
  return `${num.toFixed(digits)}%`;
}

function createStatusBuckets() {
  return { pending: 0, inCourse: 0, review: 0, done: 0, total: 0 };
}

function resolveStatusBucket(status) {
  const st = String(status || "").trim().toUpperCase();
  if (!st) return "pending";

  if (["EN_ESPERA", "PENDING"].includes(st)) return "pending";
  if (["ESPERANDO_COMPROBANTE_PAGO", "PAGO_PENDIENTE_REVISION", "AWAITING_PAYMENT_PROOF", "PAYMENT_PENDING_REVIEW"].includes(st)) return "review";
  if (["COMPLETADO", "CANCELADO", "CANCELED", "CANCELLED", "RESOLVED", "CLOSED", "REJECTED"].includes(st)) return "done";
  return "inCourse";
}

function addToStatusBuckets(counter, status, amount = 1) {
  const value = Number(amount || 0);
  if (!counter || !Number.isFinite(value) || value <= 0) return;
  const bucket = resolveStatusBucket(status);
  counter[bucket] = Number(counter[bucket] || 0) + value;
  counter.total = Number(counter.total || 0) + value;
}

function buildRequestStatusBuckets(rows = CACHE) {
  const counter = createStatusBuckets();
  (Array.isArray(rows) ? rows : []).forEach((entry) => {
    addToStatusBuckets(counter, entry?.data?.status, 1);
  });
  return counter;
}

function buildEmergencyStatusBuckets(rows = EMERGENCY_CALLS_CACHE) {
  const counter = createStatusBuckets();
  (Array.isArray(rows) ? rows : []).forEach((call) => {
    addToStatusBuckets(counter, normalizeEmergencyStatusForBoss(call?.status), 1);
  });
  return counter;
}

function sumStatusBuckets(a = createStatusBuckets(), b = createStatusBuckets()) {
  return {
    pending: Number(a.pending || 0) + Number(b.pending || 0),
    inCourse: Number(a.inCourse || 0) + Number(b.inCourse || 0),
    review: Number(a.review || 0) + Number(b.review || 0),
    done: Number(a.done || 0) + Number(b.done || 0),
    total: Number(a.total || 0) + Number(b.total || 0),
  };
}

function buildCategoryCounts(rows = CACHE, limit = 4) {
  const map = new Map();
  (Array.isArray(rows) ? rows : []).forEach((entry) => {
    const raw = normalizeName(entry?.data?.category || entry?.data?.serviceType || "General");
    const label = raw ? raw : "General";
    map.set(label, Number(map.get(label) || 0) + 1);
  });

  const sorted = Array.from(map.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  const limited = sorted.slice(0, limit);
  const rest = sorted.slice(limit).reduce((sum, item) => sum + Number(item.value || 0), 0);
  if (rest > 0) {
    limited.push({ label: "Otros", value: rest });
  }
  return limited;
}

function buildDonutGradient(items) {
  const total = items.reduce((sum, item) => sum + Number(item.value || 0), 0);
  if (!total) {
    return "conic-gradient(rgba(126,164,215,0.5) 0 100%)";
  }

  let offset = 0;
  const parts = items.map((item) => {
    const pct = (Number(item.value || 0) / total) * 100;
    const start = offset;
    offset += pct;
    return `${item.color} ${start}% ${offset}%`;
  });
  return `conic-gradient(${parts.join(", ")})`;
}

function renderCategoryDistribution(rows = CACHE) {
  if (!dashCategoryDonut || !dashCategoryLegend || !dashCategoryTopCount || !dashCategoryTopLabel) return;

  const palette = ["#8bb7ff", "#74f0d4", "#f2b5ff", "#ffcf8c", "#b9c8ff"];
  const categories = buildCategoryCounts(rows, 4).map((item, index) => ({
    ...item,
    color: palette[index % palette.length],
  }));
  const total = categories.reduce((sum, item) => sum + Number(item.value || 0), 0);
  const top = categories[0];

  dashCategoryDonut.style.background = buildDonutGradient(categories);

  if (!top) {
    dashCategoryTopCount.textContent = "0";
    dashCategoryTopLabel.textContent = "Sin categoría";
    dashCategoryLegend.innerHTML = '<div class="dash-empty">Sin datos para categorías.</div>';
    return;
  }

  dashCategoryTopCount.textContent = String(Number(top.value || 0));
  dashCategoryTopLabel.textContent = `${top.label} · ${formatPercent((top.value / Math.max(1, total)) * 100, 1)}`;

  dashCategoryLegend.innerHTML = categories.map((item) => {
    const ratio = formatPercent((Number(item.value || 0) / Math.max(1, total)) * 100, 1);
    return `
      <div class="dash-legend-item">
        <span class="dash-swatch" style="background:${item.color};"></span>
        <span class="dash-legend-name">${escapeHtml(item.label)}</span>
        <strong>${Number(item.value || 0)} · ${ratio}</strong>
      </div>
    `;
  }).join("");
}

function renderStatusBars(statusTotals) {
  if (!dashStatusBars) return;
  const total = Math.max(1, Number(statusTotals?.total || 0));
  const config = [
    { key: "pending", label: "Pendientes", color: "#8bb7ff" },
    { key: "inCourse", label: "En curso", color: "#74f0d4" },
    { key: "review", label: "En revisión", color: "#f2b5ff" },
    { key: "done", label: "Finalizadas", color: "#8ef4b0" },
  ];

  dashStatusBars.innerHTML = config.map((item) => {
    const value = Number(statusTotals?.[item.key] || 0);
    const pct = (value / total) * 100;
    return `
      <div class="dash-bar-row">
        <span>${item.label}</span>
        <div class="dash-bar-track">
          <span style="width:${pct}%; background:${item.color};"></span>
        </div>
        <strong>${value}</strong>
      </div>
    `;
  }).join("");
}

function renderMatrix(requestBuckets, emergencyBuckets) {
  if (!dashMatrixBody) return;
  const totalBuckets = sumStatusBuckets(requestBuckets, emergencyBuckets);
  const rows = [
    { label: "Solicitudes", data: requestBuckets },
    { label: "Emergencias", data: emergencyBuckets },
    { label: "Total", data: totalBuckets, total: true },
  ];

  dashMatrixBody.innerHTML = rows.map((row) => `
    <tr class="${row.total ? "is-total" : ""}">
      <td>${row.label}</td>
      <td>${Number(row.data.pending || 0)}</td>
      <td>${Number(row.data.inCourse || 0)}</td>
      <td>${Number(row.data.review || 0)}</td>
      <td>${Number(row.data.done || 0)}</td>
      <td>${Number(row.data.total || 0)}</td>
    </tr>
  `).join("");
}

function buildDashboardAnalyticsRows() {
  const requestRows = CACHE.map((entry) => {
    const req = entry?.data || {};
    const amount = Number(req.finalAmount ?? req.quotedAmount ?? req.amount ?? 0);
    const category = normalizeName(req.category || req.serviceType || "General");
    const employeeKey = normalizeName(req.assignedEmployeeId || req.employeeEmail || getEmployeeDisplayName(req));
    const employeeLabel = normalizeName(getEmployeeDisplayName(req) || "Sin técnico");
    const clientKey = normalizeName(req.clientEmail || req.clientUid || req.clientNickname || req.clientName);
    const clientLabel = normalizeName(req.clientNickname || req.clientName || req.clientEmail || "Cliente");
    const urgency = normalizeName(req.urgencia || req.priority || "normal").toLowerCase();
    const status = normalizeName(req.status || "EN_ESPERA").toUpperCase();
    const createdAt = normalizeAuditDate(req.paymentProofAt || req.bossApprovedAt || req.updatedAt || req.createdAt);

    return {
      id: normalizeName(entry?.id),
      sourceType: "request",
      amount: Number.isFinite(amount) ? amount : 0,
      categoryKey: category || "General",
      categoryLabel: category || "General",
      employeeKey,
      employeeLabel,
      clientKey,
      clientLabel,
      urgency,
      status,
      statusBucket: resolveStatusBucket(status),
      createdAt: createdAt || null,
    };
  });

  const emergencyRows = EMERGENCY_CALLS_CACHE.map((call) => {
    const amount = Number(call?.finalAmount ?? call?.quotedAmount ?? 0);
    const category = normalizeName(call?.category || call?.serviceType || "Emergencia");
    const employeeKey = normalizeName(call?.assignedEmployeeId || call?.assignedEmployeeEmail || getEmployeeDisplayName(call));
    const employeeLabel = normalizeName(call?.assignedEmployeeName || call?.assignedEmployeeEmail || "Sin técnico");
    const clientKey = normalizeName(call?.clientEmail || call?.clientId || call?.clientName);
    const clientLabel = normalizeName(call?.clientName || call?.clientEmail || "Cliente");
    const urgency = normalizeName(call?.urgencia || call?.priority || "alta").toLowerCase();
    const normalizedStatus = normalizeEmergencyStatusForBoss(call?.status);
    const createdAt = normalizeAuditDate(call?.paymentProofAt || call?.bossApprovedAt || call?.updatedAt || call?.createdAt || call?.paymentProofAtMs || call?.updatedAtMs || call?.createdAtMs);

    return {
      id: normalizeName(call?.id),
      sourceType: "emergency",
      amount: Number.isFinite(amount) ? amount : 0,
      categoryKey: category || "Emergencia",
      categoryLabel: category || "Emergencia",
      employeeKey,
      employeeLabel,
      clientKey,
      clientLabel,
      urgency,
      status: normalizedStatus,
      statusBucket: resolveStatusBucket(normalizedStatus),
      createdAt: createdAt || null,
    };
  });

  return [...requestRows, ...emergencyRows];
}

function filterDashboardRows(rows, filters = {}) {
  const data = Array.isArray(rows) ? rows : [];
  const source = normalizeName(filters.source || "all") || "all";
  const employee = normalizeName(filters.employee);
  const category = normalizeName(filters.category);
  const status = normalizeName(filters.status || "all") || "all";
  const client = normalizeName(filters.client);
  const urgency = normalizeName(filters.urgency || "all").toLowerCase() || "all";
  const minRaw = Number(filters.amountMin);
  const maxRaw = Number(filters.amountMax);
  const fromRaw = normalizeName(filters.dateFrom);
  const toRaw = normalizeName(filters.dateTo);
  let min = Number.isFinite(minRaw) ? minRaw : NaN;
  let max = Number.isFinite(maxRaw) ? maxRaw : NaN;
  const fromDate = fromRaw ? new Date(`${fromRaw}T00:00:00`) : null;
  const toDate = toRaw ? new Date(`${toRaw}T23:59:59.999`) : null;

  if (Number.isFinite(min) && Number.isFinite(max) && min > max) {
    const temp = min;
    min = max;
    max = temp;
  }

  return data.filter((row) => {
    if (source !== "all" && row.sourceType !== source) return false;
    if (employee && row.employeeKey !== employee) return false;
    if (category && row.categoryKey !== category) return false;
    if (status !== "all" && row.statusBucket !== status) return false;
    if (client && row.clientKey !== client) return false;
    if (urgency !== "all" && normalizeName(row.urgency).toLowerCase() !== urgency) return false;
    if (Number.isFinite(min) && Number(row.amount || 0) < min) return false;
    if (Number.isFinite(max) && Number(row.amount || 0) > max) return false;
    if (fromDate && (!row.createdAt || row.createdAt < fromDate)) return false;
    if (toDate && (!row.createdAt || row.createdAt > toDate)) return false;
    return true;
  });
}

function buildBucketsFromDashboardRows(rows = []) {
  const requestBuckets = createStatusBuckets();
  const emergencyBuckets = createStatusBuckets();

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    if (row.sourceType === "emergency") {
      addToStatusBuckets(emergencyBuckets, row.status, 1);
    } else {
      addToStatusBuckets(requestBuckets, row.status, 1);
    }
  });

  return {
    requestBuckets,
    emergencyBuckets,
    totalBuckets: sumStatusBuckets(requestBuckets, emergencyBuckets),
  };
}

function syncDashboardFilterOptions(rows = []) {
  const employeeEntries = (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      value: normalizeName(row.employeeKey),
      label: normalizeName(row.employeeLabel) || normalizeName(row.employeeKey),
    }))
    .filter((item) => item.value);
  const categoryValues = Array.from(new Set(
    (Array.isArray(rows) ? rows : [])
      .map((row) => normalizeName(row.categoryKey))
      .filter(Boolean)
  ));
  const clientEntries = (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      value: normalizeName(row.clientKey),
      label: normalizeName(row.clientLabel) || normalizeName(row.clientKey),
    }))
    .filter((item) => item.value);

  const previousEmployee = normalizeName(dashFilterEmployee?.value || dashFilterEmployee?.dataset.pendingValue || "");
  const previousCategory = normalizeName(dashFilterCategory?.value || dashFilterCategory?.dataset.pendingValue || "");
  const previousClient = normalizeName(dashFilterClient?.value || dashFilterClient?.dataset.pendingValue || "");

  syncDashboardMappedOptions(dashFilterEmployee, employeeEntries, "Todos");
  syncDashboardSelectOptions(dashFilterCategory, categoryValues, "Todas");
  syncDashboardMappedOptions(dashFilterClient, clientEntries, "Todos");

  const employeeValues = employeeEntries.map((item) => item.value);
  const clientValues = clientEntries.map((item) => item.value);

  if (dashFilterEmployee) {
    dashFilterEmployee.value = employeeValues.includes(previousEmployee) ? previousEmployee : "";
    delete dashFilterEmployee.dataset.pendingValue;
  }
  if (dashFilterCategory) {
    dashFilterCategory.value = categoryValues.includes(previousCategory) ? previousCategory : "";
    delete dashFilterCategory.dataset.pendingValue;
  }
  if (dashFilterClient) {
    dashFilterClient.value = clientValues.includes(previousClient) ? previousClient : "";
    delete dashFilterClient.dataset.pendingValue;
  }
}

function countUniqueEmployeesFromDashboardRows(rows = []) {
  const set = new Set();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    if (!["inCourse", "review"].includes(row.statusBucket)) return;
    const key = normalizeName(row.employeeKey);
    if (key) set.add(key);
  });
  return set.size;
}

function renderSystemDashboard() {
  const dashboardCard = document.getElementById("bossDashboardCard");
  if (!dashboardCard) return;

  const allRows = buildDashboardAnalyticsRows();
  syncDashboardFilterOptions(allRows);
  const filters = readDashboardFiltersFromDOM();
  const filteredRows = filterDashboardRows(allRows, filters);
  const { requestBuckets, emergencyBuckets, totalBuckets } = buildBucketsFromDashboardRows(filteredRows);

  const commissionRows = filteredRows
    .filter((row) => Number.isFinite(Number(row.amount || 0)) && Number(row.amount || 0) > 0)
    .filter((row) => ["review", "done"].includes(row.statusBucket))
    .map((row) => ({
      createdAt: row.createdAt || new Date(),
      commissionAmount: Math.round(Number(row.amount || 0) * BOSS_COMMISSION_RATE * 100) / 100,
    }));

  const { todayTotal, allTotal } = computeCommissionTotals(commissionRows);
  const avgCommission = commissionRows.length ? (allTotal / commissionRows.length) : 0;
  const closureRate = totalBuckets.total ? (Number(totalBuckets.done || 0) / totalBuckets.total) * 100 : 0;
  const reviewRisk = totalBuckets.total ? (Number(totalBuckets.review || 0) / totalBuckets.total) * 100 : 0;
  const uniqueEmployees = countUniqueEmployeesFromDashboardRows(filteredRows);
  const activeLoad = Number(totalBuckets.inCourse || 0) + Number(totalBuckets.review || 0);
  const coverageRate = activeLoad > 0 ? Math.min(100, (uniqueEmployees / activeLoad) * 100) : 100;
  const auditIntensity = Number(filteredRows.length || 0) > 0
    ? (Number(Array.isArray(AUDIT_CACHE) ? AUDIT_CACHE.length : 0) / Number(filteredRows.length || 1))
    : 0;
  const operationalHealth = Math.max(
    0,
    Math.min(100, ((closureRate * 0.55) + ((100 - reviewRisk) * 0.45)))
  );
  const realtimeOn = String(rtPill?.dataset.state || "").toLowerCase() === "on";
  const working = Number(totalBuckets.inCourse || 0);
  const reviewQueueCount = (Array.isArray(REVIEW_QUEUE_CACHE) ? REVIEW_QUEUE_CACHE : [])
    .map((row) => normalizeReviewQueueRow(row))
    .filter((row) => Boolean(row.recordId))
    .length;

  if (dashRealtime) {
    dashRealtime.textContent = realtimeOn ? "ON" : "OFF";
    dashRealtime.dataset.state = realtimeOn ? "on" : "off";
  }
  if (dashFilterResult) dashFilterResult.textContent = `Mostrando ${filteredRows.length} de ${allRows.length}`;
  if (dashTotalRequests) dashTotalRequests.textContent = String(Number(totalBuckets.total || 0));
  if (dashWorkingRequests) dashWorkingRequests.textContent = String(working);
  if (dashReviewQueue) dashReviewQueue.textContent = String(reviewQueueCount);
  if (dashEmergencyActive) dashEmergencyActive.textContent = String(Number(emergencyBuckets.total || 0));
  if (dashAuditEvents) dashAuditEvents.textContent = String(Array.isArray(AUDIT_CACHE) ? AUDIT_CACHE.length : 0);
  if (dashClosureRate) dashClosureRate.textContent = formatPercent(closureRate, 1);
  if (dashCommissionToday) dashCommissionToday.textContent = formatCurrency(todayTotal);
  if (dashCommissionAll) dashCommissionAll.textContent = formatCurrency(allTotal);
  if (dashAvgCommission) dashAvgCommission.textContent = formatCurrency(avgCommission);
  if (dashPendingProofs) dashPendingProofs.textContent = String(reviewQueueCount);
  if (dashOperationalHealth) dashOperationalHealth.textContent = formatPercent(operationalHealth, 0);
  if (dashReviewRisk) dashReviewRisk.textContent = formatPercent(reviewRisk, 1);
  if (dashEmployeeCoverage) dashEmployeeCoverage.textContent = formatPercent(coverageRate, 0);
  if (dashAuditIntensity) dashAuditIntensity.textContent = `${auditIntensity.toFixed(1)}x`;

  renderCategoryDistribution(
    filteredRows
      .filter((row) => row.sourceType === "request")
      .map((row) => ({ data: { category: row.categoryLabel } }))
  );
  renderStatusBars(totalBuckets);
  renderMatrix(requestBuckets, emergencyBuckets);

  updateDashboardSectionToggleButton();
}

function startRealtime(force = false) {
  if (force && UNSUB) {
    UNSUB(); UNSUB = null;
  }
  if (UNSUB) { render(); return; }

  rtPill.dataset.state = "on";
  rtPill.textContent = "Tiempo real activo";

  const q = query(
    collection(db, "requests"),
    orderBy("createdAt", "desc"),
    limit(120)
  );

  UNSUB = onSnapshot(q, async (snap) => {
    const items = [];
    snap.forEach(d => items.push({ id: d.id, data: d.data() }));
    processRequestNotifications(items);
    CACHE = items;
    await ensureEmployeeNames(items.map((item) => item.data));
    render();
    startAuditRealtime(false);
  }, (err) => {
    console.error("Boss onSnapshot error:", err);
    rtPill.dataset.state = "off";
    rtPill.textContent = "Tiempo real en pausa";
    renderSystemDashboard();
    renderAuditEmpty("No se pudo cargar la actividad operativa.");
    if (empty) {
      empty.style.display = "block";
      empty.innerHTML = `< b > No se pudo leer Firestore.</b > <br />Revisá rules / permisos.`;
    }
  });
}

function toArrayPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function normalizeReviewQueueRow(raw = {}) {
  const sourceType = normalizeName(raw?.sourceType || "").toLowerCase() === "emergency" ? "emergency" : "request";
  const sourceLabel = normalizeName(raw?.sourceLabel) || (sourceType === "emergency" ? "Emergencia" : "Solicitud");
  const recordId = normalizeName(raw?.recordId || raw?.id || raw?.requestId || "");
  const amountRaw = Number(raw?.amount ?? raw?.finalAmount ?? raw?.quotedAmount);
  const amount = Number.isFinite(amountRaw) ? amountRaw : 0;
  const proofDateRaw = raw?.paymentProofAt || raw?.proofDateRaw || raw?.updatedAt || raw?.createdAt || raw?.paymentProofAtMs || null;
  const proofUrl = normalizeName(raw?.paymentProofUrl || raw?.proofUrl || "");
  const employeeName = normalizeName(raw?.employeeName || raw?.assignedEmployeeName || raw?.employeeEmail || raw?.assignedEmployeeEmail || "Sin técnico");
  const clientName = normalizeName(raw?.clientName || raw?.clientNickname || raw?.clientEmail || "Cliente");
  const description = normalizeName(raw?.description || raw?.issue || "Sin descripción");
  const address = normalizeName(raw?.address || raw?.location || "Sin dirección");

  return {
    sourceType,
    sourceLabel,
    recordId,
    amount,
    proofDateRaw,
    proofUrl,
    employeeName,
    clientName,
    description,
    address,
  };
}

function renderEmergencyPaymentsPanel() {
  if (!emergencyPaymentsList) return;
  const pending = (Array.isArray(REVIEW_QUEUE_CACHE) ? REVIEW_QUEUE_CACHE : []).map((row) => normalizeReviewQueueRow(row));
  const html = [];

  if (REVIEW_QUEUE_LAST_ERROR) {
    html.push(`<div class="pro-audit-empty">${escapeHtml(REVIEW_QUEUE_LAST_ERROR)}</div>`);
  }

  if (!pending.length) {
    html.push('<div class="pro-audit-empty">No hay comprobantes pendientes de aprobación.</div>');
    emergencyPaymentsList.innerHTML = html.join("");
    return;
  }

  html.push(pending.map((item) => {
    const amountLabel = `$${Number(item.amount || 0).toLocaleString()}`;
    const commission = Math.round(Number(item.amount || 0) * BOSS_COMMISSION_RATE * 100) / 100;
    const commissionLabel = `$${commission.toLocaleString()}`;
    const proofDate = formatAuditDate(item.proofDateRaw);
    const employeeName = escapeHtml(item.employeeName || "Sin técnico");
    const clientName = escapeHtml(item.clientName || "Cliente");
    const description = escapeHtml(item.description || "Sin descripción");
    const address = escapeHtml(item.address || "Sin dirección");
    const proofUrl = normalizeName(item.proofUrl);
    const sourceLabel = escapeHtml(item.sourceLabel || "Canal");
    const sourceAttr = encodeURIComponent(item.sourceType || "request");
    const recordAttr = encodeURIComponent(item.recordId || "");
    const canAct = Boolean(item.recordId);
    const proofHtml = proofUrl
      ? `
        <a href="${proofUrl}" target="_blank" rel="noopener noreferrer" style="display:block; margin-top:10px;">
          <img src="${proofUrl}" alt="Comprobante ${sourceLabel}" style="width:100%; max-height:240px; object-fit:contain; border-radius:10px; border:1px solid rgba(34,197,94,0.45);" />
        </a>
      `
      : '<div style="margin-top:10px; opacity:.7;">Sin imagen de comprobante.</div>';

    return `
      <article data-review-source="${sourceAttr}" data-review-id="${recordAttr}" style="background:rgba(2,6,23,0.48); border:1px solid rgba(148,163,184,0.25); border-radius:12px; padding:12px;">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">
          <strong style="font-size:1rem;">${sourceLabel}: ${escapeHtml(item.recordId || "—")}</strong>
          <span class="badge" style="background:rgba(251,191,36,0.14); border-color:rgba(251,191,36,0.4); color:#fbbf24;">Pago pendiente revisión</span>
        </div>
        <div style="margin-top:8px; display:grid; gap:4px; font-size:.9rem; opacity:.9;">
          <div><strong>Canal:</strong> ${sourceLabel}</div>
          <div><strong>Técnico:</strong> ${employeeName}</div>
          <div><strong>Cliente:</strong> ${clientName}</div>
          <div><strong>Monto trabajo:</strong> ${amountLabel}</div>
          <div><strong>Depósito jefe (20%):</strong> ${commissionLabel}</div>
          <div><strong>Enviado:</strong> ${proofDate}</div>
          <div><strong>Descripción:</strong> ${description}</div>
          <div><strong>Dirección:</strong> ${address}</div>
        </div>
        ${proofHtml}
        <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;">
          <button class="btn btn-green" type="button" data-boss-action="approve-review-payment" ${canAct ? "" : "disabled"}>Aprobar pago</button>
          <button class="btn btn-danger" type="button" data-boss-action="reject-review-payment" ${canAct ? "" : "disabled"}>Rechazar y pedir nuevo comprobante</button>
        </div>
      </article>
    `;
  }).join(""));

  emergencyPaymentsList.innerHTML = html.join("");
}

async function fetchReviewQueue({ silent = false } = {}) {
  if (!silent && emergencyPaymentsList) {
    emergencyPaymentsList.innerHTML = '<div class="pro-audit-empty">Cargando cola de pagos pendientes...</div>';
  }

  try {
    const payload = await apiFetch(`/api/marketplace/boss/review-queue?limit=${REVIEW_QUEUE_LIMIT}`);
    REVIEW_QUEUE_CACHE = toArrayPayload(payload);
    processReviewQueueNotifications(REVIEW_QUEUE_CACHE);
    REVIEW_QUEUE_LAST_ERROR = "";
    renderEmergencyPaymentsPanel();
    renderSystemDashboard();
  } catch (err) {
    console.error("Error loading boss review queue:", err);
    REVIEW_QUEUE_LAST_ERROR = `No se pudo cargar la cola de pagos: ${err?.message || "error desconocido"}`;
    renderEmergencyPaymentsPanel();
    renderSystemDashboard();
  }
}

async function fetchEmergencyCalls({ silent = false } = {}) {
  try {
    const payload = await apiFetch("/api/marketplace/emergency-calls?limit=100");
    EMERGENCY_CALLS_CACHE = toArrayPayload(payload);
    processEmergencyNotifications(EMERGENCY_CALLS_CACHE);
    await ensureEmployeeNames(EMERGENCY_CALLS_CACHE.map((call) => ({
      assignedEmployeeId: call?.assignedEmployeeId,
      employeeEmail: call?.assignedEmployeeEmail,
      employeeName: call?.assignedEmployeeName,
    })));
    loadEarnings();
  } catch (err) {
    console.error("Error loading emergency calls for boss panel:", err);
  }
}

function startEmergencyPolling() {
  if (EMERGENCY_POLL_TIMER) return;
  EMERGENCY_POLL_TIMER = setInterval(() => {
    fetchEmergencyCalls({ silent: true }).catch(() => {});
    fetchReviewQueue({ silent: true }).catch(() => {});
  }, 7000);
}

function stopEmergencyPolling() {
  if (!EMERGENCY_POLL_TIMER) return;
  clearInterval(EMERGENCY_POLL_TIMER);
  EMERGENCY_POLL_TIMER = null;
}

window.approveEmergencyPaymentReq = async (id) => {
  const requestId = normalizeName(id);
  if (!requestId) return;
  const ok = confirm("¿Confirmas la aprobación del pago de esta emergencia?");
  if (!ok) return;

  try {
    await apiFetch(`/api/marketplace/emergency-calls/${requestId}/approve-payment`, {
      method: "POST"
    });
    alert("✅ Pago de emergencia aprobado.");
    await Promise.all([
      fetchEmergencyCalls({ silent: true }),
      fetchReviewQueue({ silent: true }),
    ]);
  } catch (err) {
    console.error("approveEmergencyPaymentReq error", err);
    alert("❌ Error aprobando pago de emergencia: " + (err?.message || err?.status));
  }
};

window.rejectEmergencyPaymentReq = async (id) => {
  const requestId = normalizeName(id);
  if (!requestId) return;
  const reasonRaw = prompt("Motivo del rechazo (opcional).");
  if (reasonRaw === null) return;
  const reason = normalizeName(reasonRaw).slice(0, 300);
  const ok = confirm("¿Rechazar este comprobante y solicitar uno nuevo?");
  if (!ok) return;

  try {
    await apiFetch(`/api/marketplace/emergency-calls/${requestId}/reject-payment`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
    alert("✅ Comprobante rechazado. Se solicitó un nuevo comprobante al técnico.");
    await Promise.all([
      fetchEmergencyCalls({ silent: true }),
      fetchReviewQueue({ silent: true }),
    ]);
  } catch (err) {
    console.error("rejectEmergencyPaymentReq error", err);
    alert("❌ Error rechazando pago de emergencia: " + (err?.message || err?.status));
  }
};

// ===== MASTER RENDERER =====
function renderList() {
  if (!list) return;
  const filtered = CACHE.filter(x => canSee(x.data));

  if (filtered.length === 0) {
    list.innerHTML = `<div style="padding:20px; text-align:center; opacity:0.6; font-size:0.9rem;">No hay solicitudes en "${FILTER}"</div>`;
    return;
  }

  // Sort: Urgency first, then Date desc
  filtered.sort((a, b) => {
    const uA = (a.data.urgencia === "alta") ? 1 : 0;
    const uB = (b.data.urgencia === "alta") ? 1 : 0;
    if (uB !== uA) return uB - uA;
    // Date desc
    const tA = a.data.createdAt?.toDate?.()?.getTime() || 0;
    const tB = b.data.createdAt?.toDate?.()?.getTime() || 0;
    return tB - tA;
  });

  list.innerHTML = filtered.map(item => {
    const r = item.data;
    const id = item.id;
    const isActive = (id === SELECTED_ID);

    // Status color helper
    let color = "#94a3b8"; // default
    const st = (r.status || "").toUpperCase();
    if (st.includes("ESPERA")) color = "#22c55e"; // Green
    if (st.includes("ASIGNADO") || st.includes("NEGOCIANDO")) color = "#3b82f6"; // Blue
    if (st.includes("PROCESO")) color = "#6366f1"; // Indigo
    if (st.includes("PAGO") || st.includes("COMPROBANTE")) color = "#f59e0b"; // Amber (Review)
    if (st.includes("COMPLETADO")) color = "#10b981"; // Emerald
    if (st.includes("CANCELADO")) color = "#ef4444"; // Red

    const urgencyBadge = (r.urgencia === 'alta')
      ? `<span style="color:#ef4444; font-weight:900; font-size:0.7rem; float:right;">🔥 URGENTE</span>`
      : '';

    return `
      <div class="mini-card ${isActive ? 'active' : ''}" role="button" tabindex="0" data-boss-action="select-request" data-request-id="${encodeURIComponent(id)}">
        ${urgencyBadge}
        <h3>${escapeHtml(r.clientNickname || 'Cliente')}</h3>
        <div class="meta-row">
           <span>${r.category || 'General'}</span>
           <span>•</span>
           <span>${fmtDate(r.createdAt)}</span>
        </div>
        <div class="meta-row" style="margin-top:6px;">
           <span style="color:${color}; font-weight:800; font-size:0.75rem;">${st.replace(/_/g, " ")}</span>
        </div>
      </div>
    `;
  }).join("");
}

// ===== DETAIL RENDERER =====
function renderDetail() {
  const detailEmpty = document.getElementById("detailEmpty");
  const detailView = document.getElementById("detailView");

  if (!SELECTED_ID) {
    if (detailEmpty) detailEmpty.style.display = "flex";
    if (detailView) detailView.style.display = "none";
    return;
  }

  const cached = CACHE.find(x => x.id === SELECTED_ID);
  if (!cached) return;
  const req = cached.data;
  const id = cached.id;
  const isPaymentPending = req.status === "PAGO_PENDIENTE_REVISION";
  const isPaymentDone = req.status === "COMPLETADO";
  const paymentProofHtml = req.paymentProofUrl ? `
       <div class="action-hero" style="border-color:#22c55e;">
         <h3 style="margin-top:0; color:#22c55e;">Comprobante de Pago</h3>
         <a href="${req.paymentProofUrl}" target="_blank">
           <img src="${req.paymentProofUrl}" style="width:100%; max-height:300px; object-fit:contain; border-radius:8px; margin-top:10px;" />
         </a>
         ${isPaymentPending ? `
         <div style="margin-top:12px; display:flex; gap:10px; flex-wrap:wrap;">
            <button class="btn btn-green" type="button" style="flex:1;" data-boss-action="approve-payment" data-request-id="${encodeURIComponent(id)}">APROBAR PAGO</button>
            <button class="btn btn-danger" type="button" style="flex:1;" data-boss-action="reject-payment" data-request-id="${encodeURIComponent(id)}">RECHAZAR Y PEDIR NUEVO COMPROBANTE</button>
         </div>
         ` : `
         <div style="margin-top:12px; display:flex; align-items:center; gap:10px;">
            <span class="badge" style="background:rgba(34,197,94,0.2); border-color:rgba(34,197,94,0.4); color:#22c55e;">PAGO ${isPaymentDone ? 'COMPLETADO' : 'REGISTRADO'}</span>
            <span style="opacity:.75; font-size:.9rem;">El pago ya fue procesado.</span>
         </div>
         `}
       </div>
    ` : '';

  if (detailEmpty) detailEmpty.style.display = "none";
  if (detailView) detailView.style.display = "block";

  detailView.innerHTML = `
    <div class="detail-header-pro">
      <div>
        <button type="button" class="btn btn-secondary detail-back-btn" style="margin-bottom:10px; padding:4px 10px; font-size:0.8rem; display:none;" data-boss-action="close-detail">⬅ Volver</button>
        <div style="font-size:0.8rem; color:var(--text-dim);">ID: ${id}</div>
        <h2 style="margin:4px 0 0 0;">${escapeHtml(req.clientNickname || 'Sin Nombre')}</h2>
        <div style="font-size:0.9rem; opacity:0.8;">${escapeHtml(req.clientEmail || '')}</div>
      </div>
      <div class="detail-header-actions">
        <div class="badge" style="background:#fff2; font-size:0.9rem;">
          ${(req.status || 'EN_ESPERA').replace(/_/g, " ")}
        </div>
        <button type="button" class="detail-close-btn" data-boss-action="close-detail" aria-label="Cerrar detalle">×</button>
      </div>
    </div>

    <!-- Info Grid -->
    <div class="detail-info-grid">
       <div class="action-hero" style="margin-top:0;">
          <small style="opacity:0.6; display:block; margin-bottom:4px;">EMPLEADO</small>
          <strong>${escapeHtml(getEmployeeDisplayName(req) || "—")}</strong>
       </div>
       <div class="action-hero" style="margin-top:0;">
          <small style="opacity:0.6; display:block; margin-bottom:4px;">CLIENTE</small>
          <strong>${escapeHtml(req.clientNickname || "—")}</strong>
       </div>
    </div>

    ${req.photoUrl ? `
      <div style="margin-top:20px;">
        <img src="${req.photoUrl}" style="width:100%; border-radius:12px; border:1px solid rgba(255,255,255,0.1); max-height:300px; object-fit:cover;" />
      </div>
    ` : ''}
    
    <div class="action-hero">
      <small style="opacity:0.6; display:block; margin-bottom:8px;">DESCRIPCIÓN</small>
      <p style="margin:0; line-height:1.5;">${escapeHtml(req.description || "")}</p>
      <div style="margin-top:10px; font-weight:bold;">📍 ${escapeHtml(req.address || "")}</div>
    </div>

    <!-- BOSS ACTIONS -->
    <div class="action-hero" style="border-color:${req.status === 'PAGO_PENDIENTE_REVISION' ? '#fbbf24' : 'rgba(255,255,255,0.1)'};">
      <h3 style="margin-top:0;">🤖 Acciones de Sistema</h3>
      ${renderBossActions(id, req)}
    </div>

    <!-- Chat & Messaging -->
    <div class="action-hero" style="border-color:rgba(96,165,250,0.45);">
      <h3 style="margin-top:0;">Chat y Mensajes</h3>
      <div style="display:flex; gap:10px; flex-wrap:wrap;">
        <button type="button" class="btn btn-secondary" data-boss-action="open-chat" data-request-id="${encodeURIComponent(id)}" data-chat-internal="0">Ver chat Cliente-Empleado</button>
        <button type="button" class="btn btn-purple" data-boss-action="open-chat" data-request-id="${encodeURIComponent(id)}" data-chat-internal="1">Mensaje privado al empleado</button>
      </div>
      <div style="margin-top:8px; opacity:.7; font-size:.85rem;">
        El mensaje privado solo lo ven Jefe y Empleado.
      </div>
    </div>

    <!-- Payments Proof -->
    ${paymentProofHtml}

    <div style="height:100px;"></div>
  `;

  if (window.innerWidth <= 900) {
    const backBtn = detailView.querySelector(".detail-back-btn");
    if (backBtn) backBtn.style.display = "inline-block";
  }
}

function renderBossActions(id, req) {
  let html = `<div style="display:flex; gap:8px; flex-wrap:wrap;">`;

  if (["EN_ESPERA", "ASIGNADO", "NEGOCIANDO", "EN_PROCESO", "ESPERANDO_CIERRE_CLIENTE"].includes(req.status)) {
    html += `<button type="button" class="btn btn-primary" data-boss-action="prepare-estimate" data-request-id="${encodeURIComponent(id)}">Crear presupuesto interno</button>`;
  }

  if (req.status === "EN_ESPERA") {
    html += `<button type="button" class="btn btn-danger" data-boss-action="cancel-request" data-request-id="${encodeURIComponent(id)}">Cancelar Solicitud</button>`;
  }

  if (["ASIGNADO", "NEGOCIANDO", "EN_PROCESO", "ESPERANDO_CIERRE_CLIENTE"].includes(req.status)) {
    html += `<button type="button" class="btn btn-secondary" data-boss-action="force-release" data-request-id="${encodeURIComponent(id)}">Forzar Liberación (Desasignar)</button>`;
  }

  // Force Finish
  if (req.status === "EN_PROCESO") {
    html += `<button type="button" class="btn btn-purple" data-boss-action="force-done" data-request-id="${encodeURIComponent(id)}">Forzar Terminación</button>`;
  }

  html += `</div>`;
  return html;
}

window.prepareBossEstimate = (id) => {
  const cached = CACHE.find((item) => item.id === id);
  if (!cached) {
    alert("No se encontro la solicitud seleccionada.");
    return;
  }

  const req = cached.data || {};
  const prefill = {
    source: "boss-panel",
    requestId: id,
    client: String(req.clientNickname || req.clientEmail || "").trim(),
    email: String(req.clientEmail || "").trim(),
    billingAddress: String(req.address || "").trim(),
    serviceAddress: String(req.address || "").trim(),
  };

  try {
    localStorage.setItem(ESTIMATE_REQUEST_PREFILL_KEY, JSON.stringify(prefill));
  } catch (_) {
    // Ignore storage restrictions and continue to the estimate form.
  }

  window.location.href = `estimate-form.html?requestId=${encodeURIComponent(id)}&mode=internal`;
};

window.openStandaloneBossEstimate = () => {
  try {
    localStorage.removeItem(ESTIMATE_REQUEST_PREFILL_KEY);
  } catch (_) {
    // Ignore storage restrictions and continue to the estimate form.
  }

  window.location.href = "estimate-form.html?mode=internal";
};

window.cancelByBoss = async (id) => {
  if (!confirm("¿Seguro de cancelar esta solicitud?")) return;
  try { await apiFetch(`/api/marketplace/requests/${id}/cancel`, { method: 'POST' }); } catch (e) { alert(e.message); }
};

function render() {
  const liveGuard = window.__SWE_LIVE_INPUT_GUARD__;
  if (liveGuard) liveGuard.captureCurrent();
  refreshKPIs();
  loadEarnings();
  renderList();
  renderDetail();
  renderEmergencyPaymentsPanel();
  if (liveGuard) liveGuard.scheduleRestore();
}

function normalizeAuditDate(rawValue) {
  if (!rawValue) return null;
  try {
    const date = rawValue.toDate ? rawValue.toDate() : new Date(rawValue);
    if (Number.isNaN(date.getTime())) return null;
    return date;
  } catch (_) {
    return null;
  }
}

function formatAuditDate(rawValue) {
  const date = normalizeAuditDate(rawValue);
  return date ? date.toLocaleString() : "—";
}

function humanizeActorKind(kind) {
  const normalized = String(kind || "").trim().toLowerCase();
  if (normalized === "employee") return "Empleado";
  if (normalized === "boss") return "Jefe";
  if (normalized === "client") return "Cliente";
  return "Sistema";
}

function humanizeActivityEvent(action) {
  const normalized = String(action || "").trim().toUpperCase();
  const labels = {
    SOLICITUD_CREADA: "Solicitud creada",
    TRABAJO_ASIGNADO: "Trabajo asignado",
    PROPUESTA_ENVIADA: "Propuesta enviada",
    PROPUESTA_ACEPTADA: "Propuesta aceptada",
    TRABAJO_FINALIZADO: "Trabajo finalizado",
    CIERRE_CLIENTE: "Cierre del cliente",
    COMPROBANTE_SUBIDO: "Comprobante subido",
    PAGO_RECHAZADO: "Pago rechazado",
    PAGO_APROBADO: "Pago aprobado",
    SOLICITUD_CANCELADA: "Solicitud cancelada",
    ACCION_FORZADA_JEFE: "Accion forzada del jefe",
    CIERRE_FORZADO_JEFE: "Cierre forzado del jefe",
  };
  return labels[normalized] || normalized;
}

function formatCurrencyPreview(rawValue) {
  const amount = Number(rawValue);
  if (!Number.isFinite(amount)) return null;
  return `$${amount.toFixed(2)}`;
}

function trimText(value, max = 80) {
  const text = normalizeName(value);
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function cleanMetadata(source = {}) {
  const metadata = {};
  Object.entries(source).forEach(([key, value]) => {
    if (value == null || value === "") return;
    metadata[key] = value;
  });
  return metadata;
}

function makeActivityRow(requestId, action, rawDate, actorKind, actorKey, actorLabel, metadata = {}) {
  const createdAt = normalizeAuditDate(rawDate);
  if (!createdAt) return null;

  const safeRequestId = normalizeName(requestId) || "sin-id";
  const safeAction = normalizeName(action) || "EVENTO";
  const safeActorKind = normalizeName(actorKind).toLowerCase() || "system";
  const safeActorKey = normalizeName(actorKey) || `${safeActorKind}:${safeRequestId}`;
  const safeActorLabel = normalizeName(actorLabel) || humanizeActorKind(safeActorKind);

  return {
    id: `${safeRequestId}:${safeAction}:${safeActorKey}:${createdAt.getTime()}`,
    requestId: safeRequestId,
    action: safeAction,
    createdAt,
    actorKind: safeActorKind,
    actorKey: safeActorKey,
    actorLabel: safeActorLabel,
    metadata: cleanMetadata(metadata),
  };
}

function pushActivityRow(rows, row) {
  if (row) rows.push(row);
}

function pushVisibleActivityRow(rows, row, hiddenIds) {
  if (!row) return;
  if (hiddenIds instanceof Set && hiddenIds.has(row.id)) return;
  rows.push(row);
}

function buildRequestBaseMetadata(requestId, req) {
  return cleanMetadata({
    cliente: trimText(req.clientNickname || req.clientEmail || "Cliente", 48),
    tecnico: trimText(getEmployeeDisplayName(req), 48),
    categoria: trimText(req.category || "", 32),
    estado: normalizeName(req.status).toUpperCase() || "—",
  });
}

function buildOperationalActivityRows() {
  const rows = [];

  CACHE.forEach((entry) => {
    const requestId = normalizeName(entry?.id);
    const req = entry?.data || {};
    if (!requestId) return;
    const hiddenIds = new Set(
      Array.isArray(req.activityHiddenIds)
        ? req.activityHiddenIds.map((value) => normalizeName(value)).filter(Boolean)
        : []
    );

    const baseMetadata = buildRequestBaseMetadata(requestId, req);
    const clientKey = normalizeName(req.clientId || req.clientEmail) || `client:${requestId}`;
    const clientLabel = trimText(req.clientNickname || req.clientEmail || "Cliente", 56);
    const employeeUid = getEmployeeUid(req);
    const employeeKey = employeeUid || normalizeName(req.employeeEmail) || `employee:${requestId}`;
    const employeeLabel = trimText(getEmployeeDisplayName(req), 56);
    const proposalAmount = formatCurrencyPreview(req.proposal?.amount);
    const finalAmount = formatCurrencyPreview(req.finalAmount);
    const bossKey = normalizeName(req.bossApprovedBy || req.closedBy) || "boss";
    const bossLabel = normalizeName(req.bossApprovedBy)
      ? `Jefe ${String(req.bossApprovedBy).slice(0, 8)}`
      : "Jefe";

    pushVisibleActivityRow(rows, makeActivityRow(
      requestId,
      "SOLICITUD_CREADA",
      req.createdAt,
      "client",
      clientKey,
      clientLabel,
      {
        ...baseMetadata,
        address: trimText(req.address || "", 52),
      }
    ), hiddenIds);

    if (employeeUid && req.assignedAt) {
      pushVisibleActivityRow(rows, makeActivityRow(
        requestId,
        "TRABAJO_ASIGNADO",
        req.assignedAt,
        "employee",
        employeeKey,
        employeeLabel,
        baseMetadata
      ), hiddenIds);
    }

    if (req.proposal?.sentAt) {
      pushVisibleActivityRow(rows, makeActivityRow(
        requestId,
        "PROPUESTA_ENVIADA",
        req.proposal.sentAt,
        "employee",
        employeeKey,
        employeeLabel,
        {
          ...baseMetadata,
          amount: proposalAmount,
        }
      ), hiddenIds);
    }

    if (req.proposalAcceptedAt) {
      pushVisibleActivityRow(rows, makeActivityRow(
        requestId,
        "PROPUESTA_ACEPTADA",
        req.proposalAcceptedAt,
        "client",
        clientKey,
        clientLabel,
        {
          ...baseMetadata,
          amount: proposalAmount,
        }
      ), hiddenIds);
    }

    if (req.finishedAt) {
      pushVisibleActivityRow(rows, makeActivityRow(
        requestId,
        "TRABAJO_FINALIZADO",
        req.finishedAt,
        "employee",
        employeeKey,
        employeeLabel,
        baseMetadata
      ), hiddenIds);
    }

    if (req.clientClosedAt) {
      pushVisibleActivityRow(rows, makeActivityRow(
        requestId,
        "CIERRE_CLIENTE",
        req.clientClosedAt,
        "client",
        clientKey,
        clientLabel,
        {
          ...baseMetadata,
          amount: finalAmount,
          rating: req.clientRating,
        }
      ), hiddenIds);
    }

    if (req.paymentProofAt) {
      const proofBy = normalizeName(req.paymentProofBy);
      const proofActorKind = proofBy && proofBy === normalizeName(req.assignedEmployeeId) ? "employee" : "client";
      const proofActorKey = proofActorKind === "employee" ? employeeKey : clientKey;
      const proofActorLabel = proofActorKind === "employee" ? employeeLabel : clientLabel;

      pushVisibleActivityRow(rows, makeActivityRow(
        requestId,
        "COMPROBANTE_SUBIDO",
        req.paymentProofAt,
        proofActorKind,
        proofActorKey,
        proofActorLabel,
        {
          ...baseMetadata,
          amount: finalAmount,
        }
      ), hiddenIds);
    }

    if (req.paymentRejectedAt || req.paymentRejectedAtMs) {
      pushVisibleActivityRow(rows, makeActivityRow(
        requestId,
        "PAGO_RECHAZADO",
        req.paymentRejectedAt || req.paymentRejectedAtMs,
        "boss",
        bossKey,
        bossLabel,
        {
          ...baseMetadata,
          amount: finalAmount,
          reason: normalizeName(req.paymentRejectionReason),
        }
      ), hiddenIds);
    }

    if (req.bossApprovedAt) {
      pushVisibleActivityRow(rows, makeActivityRow(
        requestId,
        "PAGO_APROBADO",
        req.bossApprovedAt,
        "boss",
        bossKey,
        bossLabel,
        {
          ...baseMetadata,
          amount: finalAmount,
        }
      ), hiddenIds);
    }

    if (req.cancelledAt) {
      pushVisibleActivityRow(rows, makeActivityRow(
        requestId,
        "SOLICITUD_CANCELADA",
        req.cancelledAt,
        "client",
        clientKey,
        clientLabel,
        baseMetadata
      ), hiddenIds);
    }

    if (Array.isArray(req.auditTrail)) {
      req.auditTrail.forEach((trailEntry, index) => {
        const action = normalizeName(trailEntry?.action).toLowerCase();
        const eventCode =
          action === "force-close"
            ? "CIERRE_FORZADO_JEFE"
            : action === "force-update"
              ? "ACCION_FORZADA_JEFE"
              : "";

        if (!eventCode) return;

        const bossAuditKey = normalizeName(trailEntry?.byUid) || "boss";
        const bossAuditLabel = normalizeName(trailEntry?.byUid)
          ? `Jefe ${String(trailEntry.byUid).slice(0, 8)}`
          : "Jefe";

        pushVisibleActivityRow(rows, makeActivityRow(
          requestId,
          eventCode,
          trailEntry?.at,
          "boss",
          `${bossAuditKey}:${index}`,
          bossAuditLabel,
          {
            ...baseMetadata,
            forcedStatus: trailEntry?.payloadSummary?.status || "",
            assignedTo: trailEntry?.payloadSummary?.assignedTo || "",
          }
        ), hiddenIds);
      });
    }
  });

  rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return rows;
}

function getAuditMetadataPreview(metadata) {
  if (!metadata || typeof metadata !== "object") return "—";
  const preferredKeys = [
    ["cliente", "Cliente"],
    ["tecnico", "Tecnico"],
    ["categoria", "Categoria"],
    ["estado", "Estado"],
    ["amount", "Monto"],
    ["reason", "Motivo"],
    ["rating", "Calificacion"],
    ["forcedStatus", "Estado forzado"],
    ["assignedTo", "Asignado a"],
    ["address", "Direccion"],
  ];
  const tokens = [];

  preferredKeys.forEach(([key, label]) => {
    const value = metadata[key];
    if (value == null || value === "") return;
    tokens.push(`${label}: ${String(value)}`);
  });

  if (tokens.length > 0) {
    return tokens.slice(0, 4).join(" | ").slice(0, 180);
  }

  const firstEntry = Object.entries(metadata)[0];
  if (!firstEntry) return "—";
  return `${firstEntry[0]}: ${String(firstEntry[1])}`.slice(0, 180);
}

function renderAuditEmpty(message) {
  if (!proAuditBody) return;
  proAuditBody.innerHTML = `
    <tr>
      <td colspan="5" class="pro-audit-empty">${escapeHtml(message)}</td>
    </tr>
  `;
  if (proAuditPageInfo) proAuditPageInfo.textContent = "Page 1 / 1";
  if (proAuditSummary) proAuditSummary.textContent = "0 registros";
  if (proAuditPrevBtn) proAuditPrevBtn.disabled = true;
  if (proAuditNextBtn) proAuditNextBtn.disabled = true;
  renderSystemDashboard();
}

function rebuildAuditEmployeeFilter() {
  if (!proAuditEmployeeFilter) return;
  const selected = proAuditEmployeeFilter.value || "";
  const actorsMap = new Map();

  AUDIT_CACHE.forEach((event) => {
    const actorKey = normalizeName(event.actorKey);
    if (!actorKey) return;
    const actorLabel = normalizeName(event.actorLabel) || humanizeActorKind(event.actorKind);
    if (!actorsMap.has(actorKey)) actorsMap.set(actorKey, actorLabel);
  });

  const options = ['<option value="">Todos</option>'];
  Array.from(actorsMap.entries())
    .sort((a, b) => a[1].localeCompare(b[1]))
    .forEach(([actorKey, actorLabel]) => {
      options.push(`<option value="${escapeHtml(actorKey)}">${escapeHtml(actorLabel)}</option>`);
    });

  proAuditEmployeeFilter.innerHTML = options.join("");
  proAuditEmployeeFilter.value = actorsMap.has(selected) ? selected : "";
}

function rebuildAuditActionFilter() {
  if (!proAuditActionFilter) return;
  const selected = proAuditActionFilter.value || "";
  const availableActions = new Set();

  AUDIT_CACHE.forEach((event) => {
    const action = normalizeName(event.action);
    if (!action) return;
    availableActions.add(action);
  });

  const options = ['<option value="">Todas</option>'];
  ACTIVITY_EVENTS
    .filter((action) => availableActions.has(action))
    .forEach((action) => {
      options.push(`<option value="${escapeHtml(action)}">${escapeHtml(humanizeActivityEvent(action))}</option>`);
    });

  proAuditActionFilter.innerHTML = options.join("");
  proAuditActionFilter.value = availableActions.has(selected) ? selected : "";
}

function applyAuditFilters(resetPage = true) {
  if (resetPage) AUDIT_PAGE = 1;

  const employeeFilter = String(proAuditEmployeeFilter?.value || "").trim();
  const actionFilter = String(proAuditActionFilter?.value || "").trim();
  const fromValue = proAuditFromDate?.value || "";
  const toValue = proAuditToDate?.value || "";

  const fromDate = fromValue ? new Date(`${fromValue}T00:00:00`) : null;
  const toDate = toValue ? new Date(`${toValue}T23:59:59.999`) : null;

  AUDIT_FILTERED = AUDIT_CACHE.filter((event) => {
    if (employeeFilter && String(event.actorKey || "") !== employeeFilter) return false;
    if (actionFilter && String(event.action || "") !== actionFilter) return false;

    const createdAt = normalizeAuditDate(event.createdAt);
    if (fromDate && (!createdAt || createdAt < fromDate)) return false;
    if (toDate && (!createdAt || createdAt > toDate)) return false;

    return true;
  });

  renderAuditTable();
}

function renderAuditTable() {
  if (!proAuditBody) return;
  if (!AUDIT_FILTERED.length) {
    renderAuditEmpty("No hay actividad operativa para los filtros actuales.");
    return;
  }

  const totalRows = AUDIT_FILTERED.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / AUDIT_PAGE_SIZE));
  AUDIT_PAGE = Math.min(Math.max(1, AUDIT_PAGE), totalPages);

  const start = (AUDIT_PAGE - 1) * AUDIT_PAGE_SIZE;
  const end = start + AUDIT_PAGE_SIZE;
  const visibleRows = AUDIT_FILTERED.slice(start, end);

  proAuditBody.innerHTML = visibleRows.map((event) => {
    const actorPrefix = humanizeActorKind(event.actorKind);
    const actorLabel = `${actorPrefix}: ${event.actorLabel || "—"}`;
    const metadataLabel = getAuditMetadataPreview(event.metadata);
    const actionLabel = humanizeActivityEvent(event.action);

    return `
      <tr>
        <td>${escapeHtml(formatAuditDate(event.createdAt))}</td>
        <td>${escapeHtml(actorLabel)}</td>
        <td>${escapeHtml(String(actionLabel || "—"))}</td>
        <td>${escapeHtml(metadataLabel)}</td>
        <td><button type="button" class="btn btn-danger pro-audit-delete-btn" data-boss-action="delete-audit-event" data-event-id="${encodeURIComponent(event.id || "")}">Eliminar</button></td>
      </tr>
    `;
  }).join("");

  if (proAuditPageInfo) proAuditPageInfo.textContent = `Page ${AUDIT_PAGE} / ${totalPages}`;
  if (proAuditSummary) proAuditSummary.textContent = `${visibleRows.length} de ${totalRows} registros`;
  if (proAuditPrevBtn) proAuditPrevBtn.disabled = AUDIT_PAGE <= 1;
  if (proAuditNextBtn) proAuditNextBtn.disabled = AUDIT_PAGE >= totalPages;
  renderSystemDashboard();
}

window.deleteAuditEvent = async (eventId) => {
  const normalizedEventId = normalizeName(eventId);
  if (!normalizedEventId) return;

  const event = AUDIT_CACHE.find((item) => item.id === normalizedEventId)
    || AUDIT_FILTERED.find((item) => item.id === normalizedEventId);

  if (!event || !event.requestId || event.requestId === "sin-id") {
    alert("No se pudo localizar la actividad seleccionada.");
    return;
  }

  const ok = confirm("¿Eliminar esta fila de la tabla de actividad operativa reciente?");
  if (!ok) return;

  const ref = doc(db, "requests", event.requestId);

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error("La solicitud ya no existe.");

      const data = snap.data() || {};
      const activityHiddenIds = Array.isArray(data.activityHiddenIds)
        ? data.activityHiddenIds.map((value) => normalizeName(value)).filter(Boolean)
        : [];

      if (!activityHiddenIds.includes(normalizedEventId)) {
        activityHiddenIds.push(normalizedEventId);
      }

      tx.update(ref, {
        activityHiddenIds: activityHiddenIds.slice(-300),
        updatedAt: serverTimestamp(),
      });
    });

    AUDIT_CACHE = AUDIT_CACHE.filter((item) => item.id !== normalizedEventId);
    AUDIT_FILTERED = AUDIT_FILTERED.filter((item) => item.id !== normalizedEventId);
    rebuildAuditEmployeeFilter();
    rebuildAuditActionFilter();
    renderAuditTable();
  } catch (error) {
    console.error("deleteAuditEvent error:", error);
    alert(error?.message || "No se pudo eliminar la actividad.");
  }
};

function startAuditRealtime(force = false) {
  if (!proAuditBody) return;

  AUDIT_FETCH_LIMIT = Number(proAuditLimit?.value || AUDIT_FETCH_LIMIT || 50);
  if (!Number.isFinite(AUDIT_FETCH_LIMIT) || AUDIT_FETCH_LIMIT < 1) AUDIT_FETCH_LIMIT = 50;

  const rows = buildOperationalActivityRows().slice(0, AUDIT_FETCH_LIMIT);
  AUDIT_CACHE = rows;

  rebuildAuditEmployeeFilter();
  rebuildAuditActionFilter();

  if (!AUDIT_CACHE.length) {
    renderAuditEmpty(CACHE.length ? "No hay actividad operativa para la ventana actual." : "Cargando actividad...");
    return;
  }

  applyAuditFilters(force);
}

function bindAuditEvents() {
  if (!proAuditBody || proAuditBody.dataset.bound === "1") return;

  const onFilterChange = () => applyAuditFilters(true);

  proAuditEmployeeFilter?.addEventListener("change", onFilterChange);
  proAuditActionFilter?.addEventListener("change", onFilterChange);
  proAuditFromDate?.addEventListener("change", onFilterChange);
  proAuditToDate?.addEventListener("change", onFilterChange);
  proAuditLimit?.addEventListener("change", () => {
    startAuditRealtime(true);
  });

  proAuditPrevBtn?.addEventListener("click", () => {
    AUDIT_PAGE = Math.max(1, AUDIT_PAGE - 1);
    renderAuditTable();
  });

  proAuditNextBtn?.addEventListener("click", () => {
    const totalPages = Math.max(1, Math.ceil(AUDIT_FILTERED.length / AUDIT_PAGE_SIZE));
    AUDIT_PAGE = Math.min(totalPages, AUDIT_PAGE + 1);
    renderAuditTable();
  });

  proAuditRefreshBtn?.addEventListener("click", () => {
    startRealtime(true);
    startAuditRealtime(true);
  });

  emergencyPaymentsRefreshBtn?.addEventListener("click", () => {
    window.reloadNow();
  });

  proAuditBody.dataset.bound = "1";
}

function setBrandStatus(message, tone = "muted") {
  if (!brandStatus) return;
  brandStatus.textContent = message || "";
  if (tone === "error") brandStatus.style.color = "#fca5a5";
  else if (tone === "success") brandStatus.style.color = "#86efac";
  else if (tone === "info") brandStatus.style.color = "#93c5fd";
  else brandStatus.style.color = "";
}

function setBrandFileHint(node, message, tone = "muted") {
  if (!node) return;
  node.textContent = message || "";
  if (tone === "error") node.style.color = "#fca5a5";
  else if (tone === "success") node.style.color = "#86efac";
  else if (tone === "info") node.style.color = "#93c5fd";
  else if (tone === "warning") node.style.color = "#fde68a";
  else node.style.color = "";
}

function setNotifyStatus(message, tone = "muted") {
  setBrandFileHint(notifyStatus, message, tone);
}

function setBrandWhatsappHealth(message, tone = "muted") {
  setBrandFileHint(brandWhatsappHealth, message, tone);
}

function setBrandTelegramHealth(message, tone = "muted") {
  setBrandFileHint(brandTelegramHealth, message, tone);
}

function setNotifyProductionSummary(message, tone = "muted") {
  if (!notifyProductionSummary) return;
  notifyProductionSummary.textContent = message || "";
  notifyProductionSummary.dataset.tone = tone || "muted";
}

function normalizeWhatsappNumber(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  let cleaned = raw.replace(/[^\d+]/g, "");
  if (cleaned.startsWith("00")) cleaned = `+${cleaned.slice(2)}`;
  if (!cleaned.startsWith("+")) cleaned = `+${cleaned.replace(/[+]/g, "")}`;
  const digits = cleaned.replace(/[^\d]/g, "");
  if (digits.length < 8 || digits.length > 15) return "";
  return `+${digits}`;
}

function maskConfigValue(value, { visibleStart = 2, visibleEnd = 3 } = {}) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.length <= visibleStart + visibleEnd) return `${raw.slice(0, visibleStart)}***`;
  return `${raw.slice(0, visibleStart)}***${raw.slice(-visibleEnd)}`;
}

function hasTextValue(value) {
  return String(value || "").trim().length > 0;
}

function getInternalWhatsAppWebhookUrl() {
  return `${API_BASE}/api/hooks/whatsapp/send`;
}

function isInternalWhatsAppWebhookUrl(value) {
  return String(value || "").trim().toLowerCase().includes("/api/hooks/whatsapp/send");
}

function generateWebhookSecret() {
  const prefix = "whk_";
  try {
    const bytes = new Uint8Array(18);
    window.crypto.getRandomValues(bytes);
    return `${prefix}${Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("")}`;
  } catch (_) {
    return `${prefix}${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
  }
}

function refreshInternalWhatsAppWebhookHint() {
  if (!notifyWhatsAppInternalWebhookHint) return;

  const webhookUrl = String(notifyWhatsAppWebhookUrlInput?.value || "").trim();
  const hintUrl = getInternalWhatsAppWebhookUrl();
  const isInternal = !webhookUrl || isInternalWhatsAppWebhookUrl(webhookUrl);
  const tokenConfigured = hasTextValue(notifyWhatsAppWebhookTokenInput?.value)
    || /guardado/i.test(String(notifyWhatsAppWebhookTokenHint?.textContent || ""));

  if (isInternal) {
    setBrandFileHint(
      notifyWhatsAppInternalWebhookHint,
      tokenConfigured
        ? `Webhook interno listo para usar en ${hintUrl}. Usa Bearer token y, si llenas Twilio, este mismo backend reenvia el mensaje real.`
        : `Webhook interno disponible en ${hintUrl}. Genera o pega un Bearer token antes de guardar.`,
      tokenConfigured ? "success" : "warning"
    );
    return;
  }

  setBrandFileHint(
    notifyWhatsAppInternalWebhookHint,
    `Estas usando un webhook externo. Si quieres volver al interno, usa el boton y la URL ${hintUrl}.`,
    "muted"
  );
}

function setNotifyChannelBadge(node, descriptor = {}) {
  if (!node) return;
  const state = String(descriptor.state || "pending").trim() || "pending";
  const label = String(descriptor.label || "Pendiente").trim() || "Pendiente";
  node.textContent = label;
  node.dataset.state = state;
}

function toggleNotifyTransportNodes(nodes = [], activeValue = "") {
  const active = String(activeValue || "").trim().toLowerCase();
  nodes.forEach((node) => {
    const expected = String(node.dataset.whatsappTransportGroup || node.dataset.telegramTransportGroup || "")
      .trim()
      .toLowerCase();
    const allowed = expected.split(/[\s,]+/).filter(Boolean);
    node.hidden = !allowed.includes(active);
  });
}

function syncNotificationTransportVisibility() {
  toggleNotifyTransportNodes(notifyWhatsAppTransportGroups, notifyWhatsAppTransportInput?.value || "noop");
  toggleNotifyTransportNodes(notifyTelegramTransportGroups, notifyTelegramTransportInput?.value || "disabled");
}

function getNotificationChannelReadiness(channel, status = {}) {
  const notes = Array.isArray(status.notes) ? status.notes.filter(Boolean) : [];

  if (channel === "whatsapp") {
    if (status.transport === "noop") {
      return {
        channel,
        channelLabel: "WhatsApp",
        state: "simulated",
        label: "Simulado",
        message: "WhatsApp sigue en modo simulado. Cambia el transporte a Webhook o Twilio para produccion.",
      };
    }
    if (status.ready) {
      return {
        channel,
        channelLabel: "WhatsApp",
        state: "ready",
        label: "Listo",
        message: "WhatsApp listo para produccion.",
      };
    }
    if (!status.hasConfiguredRecipient) {
      return {
        channel,
        channelLabel: "WhatsApp",
        state: "pending",
        label: "Pendiente",
        message: "WhatsApp necesita un numero destino para alertas.",
      };
    }
    if (!status.transportConfigured) {
      return {
        channel,
        channelLabel: "WhatsApp",
        state: "pending",
        label: "Pendiente",
        message: notes[0] || "Completa la configuracion del transporte WhatsApp.",
      };
    }
    return {
      channel,
      channelLabel: "WhatsApp",
      state: "pending",
      label: "Pendiente",
      message: "WhatsApp aun no esta listo para produccion.",
    };
  }

  if (status.transport === "disabled") {
    return {
      channel,
      channelLabel: "Telegram",
      state: "disabled",
      label: "Deshabilitado",
      message: "Telegram esta deshabilitado y no bloquea WhatsApp.",
    };
  }
  if (status.transport === "noop") {
    return {
      channel,
      channelLabel: "Telegram",
      state: "simulated",
      label: "Simulado",
      message: "Telegram sigue en modo simulado. Cambialo a API real para produccion.",
    };
  }
  if (status.ready) {
    return {
      channel,
      channelLabel: "Telegram",
      state: "ready",
      label: "Listo",
      message: "Telegram listo para produccion.",
    };
  }
  if (!status.hasConfiguredRecipient) {
    return {
      channel,
      channelLabel: "Telegram",
      state: "pending",
      label: "Pendiente",
      message: "Telegram necesita un chat_id o @canal por defecto.",
    };
  }
  if (!status.transportConfigured) {
    return {
      channel,
      channelLabel: "Telegram",
      state: "pending",
      label: "Pendiente",
      message: notes[0] || "Completa el bot token de Telegram.",
    };
  }
  return {
    channel,
    channelLabel: "Telegram",
    state: "pending",
    label: "Pendiente",
    message: "Telegram aun no esta listo para produccion.",
  };
}

function summarizeNotificationProduction(channels = {}) {
  const whatsapp = getNotificationChannelReadiness("whatsapp", channels.whatsapp || {});
  const telegram = getNotificationChannelReadiness("telegram", channels.telegram || {});
  const activeChannels = [whatsapp, telegram].filter((entry) => entry.state !== "disabled");

  let tone = "muted";
  let headline = "Produccion: configura al menos un canal para empezar.";

  if (!activeChannels.length) {
    headline = "Produccion: no hay canales activos. Si solo usaras uno, deja el otro deshabilitado.";
  } else if (activeChannels.every((entry) => entry.state === "ready")) {
    tone = "success";
    headline = activeChannels.length === 2
      ? "Produccion: WhatsApp y Telegram estan listos."
      : `Produccion: ${activeChannels[0].channelLabel} esta listo.`;
  } else if (activeChannels.some((entry) => entry.state === "pending")) {
    tone = "warning";
    headline = "Produccion: faltan datos para dejar listo el canal activo.";
  } else if (activeChannels.some((entry) => entry.state === "simulated")) {
    tone = "warning";
    headline = "Produccion: hay un canal guardado pero todavia esta en simulacion.";
  }

  return {
    tone,
    message: `${headline} WhatsApp: ${whatsapp.message} Telegram: ${telegram.message}`,
    whatsapp,
    telegram,
    allActiveReady: activeChannels.length > 0 && activeChannels.every((entry) => entry.state === "ready"),
  };
}

function updateNotificationProductionSummary(channels = {}) {
  const summary = summarizeNotificationProduction(channels);
  setNotifyChannelBadge(notifyWhatsAppReadyBadge, summary.whatsapp);
  setNotifyChannelBadge(notifyTelegramReadyBadge, summary.telegram);
  setNotifyProductionSummary(summary.message, summary.tone);
  return summary;
}

function inferWhatsAppProductionTransport(payload = {}) {
  const whatsapp = payload && typeof payload === "object" ? (payload.whatsapp || {}) : {};
  const currentTransport = String(whatsapp.transport || "noop").trim().toLowerCase();
  if (currentTransport === "webhook" || currentTransport === "twilio") return currentTransport;

  const candidates = [];
  if (hasTextValue(whatsapp.webhookUrl)) candidates.push("webhook");

  const hasTwilioSender = hasTextValue(whatsapp.twilioWhatsAppFrom) || hasTextValue(whatsapp.twilioMessagingServiceSid);
  if (hasTextValue(whatsapp.twilioAccountSid) && hasTextValue(whatsapp.twilioAuthToken) && hasTwilioSender) {
    candidates.push("twilio");
  }

  return candidates.length === 1 ? candidates[0] : currentTransport;
}

function inferTelegramProductionTransport(payload = {}) {
  const telegram = payload && typeof payload === "object" ? (payload.telegram || {}) : {};
  const currentTransport = String(telegram.transport || "disabled").trim().toLowerCase();
  if (currentTransport === "api") return currentTransport;
  return hasTextValue(telegram.botToken) ? "api" : currentTransport;
}

function prepareNotificationSettingsForProduction(payload = {}) {
  const next = JSON.parse(JSON.stringify(payload || {}));
  next.whatsapp = next.whatsapp && typeof next.whatsapp === "object" ? next.whatsapp : {};
  next.telegram = next.telegram && typeof next.telegram === "object" ? next.telegram : {};
  next.whatsapp.transport = inferWhatsAppProductionTransport(next);
  next.telegram.transport = inferTelegramProductionTransport(next);
  return next;
}

function formatTelegramStatusRow(status = {}) {
  const mode = String(status.mode || status.transport || "desconocido").trim();
  const ready = Boolean(status.ready);
  const simulated = Boolean(status.simulated);
  const deliveryReady = Boolean(status.deliveryReady);
  const hasRecipient = Boolean(status.hasConfiguredRecipient);
  const transportConfigured = Boolean(status.transportConfigured);
  const recipient = String(status.configuredRecipientPreview || "").trim() || "sin chat_id";
  const notes = Array.isArray(status.notes) ? status.notes.filter(Boolean) : [];
  const flowLabel = simulated
    ? "simulado (sin envio real)"
    : (ready ? "listo" : "incompleto");
  const summary = `Telegram [${mode}] · destino: ${recipient} · transporte: ${transportConfigured ? "OK" : "pendiente"} · flujo: ${flowLabel}.`;
  return {
    message: notes.length ? `${summary} ${notes[0]}` : summary,
    tone: ready ? "success" : (simulated ? "warning" : (deliveryReady ? "info" : (hasRecipient ? "info" : "muted"))),
  };
}

function formatWhatsappStatusRow(status = {}) {
  const mode = String(status.mode || status.transport || "desconocido").trim();
  const ready = Boolean(status.ready);
  const simulated = Boolean(status.simulated);
  const deliveryReady = Boolean(status.deliveryReady);
  const hasRecipient = Boolean(status.hasConfiguredRecipient);
  const transportConfigured = Boolean(status.transportConfigured);
  const recipient = String(status.configuredRecipientPreview || "").trim() || "sin numero";
  const notes = Array.isArray(status.notes) ? status.notes.filter(Boolean) : [];
  const flowLabel = simulated
    ? "simulado (sin envio real)"
    : (ready ? "listo" : "incompleto");
  const summary = `WhatsApp [${mode}] · destino: ${recipient} · transporte: ${transportConfigured ? "OK" : "pendiente"} · flujo: ${flowLabel}.`;
  return {
    message: notes.length ? `${summary} ${notes.slice(0, 2).join(" ")}` : summary,
    tone: ready ? "success" : (simulated ? "warning" : (deliveryReady ? "info" : (hasRecipient ? "info" : "muted"))),
  };
}

function getAssetDisplayName(url) {
  const value = String(url || "").trim();
  if (!value) return "";

  try {
    const parsed = new URL(value, window.location.href);
    const pathname = decodeURIComponent(parsed.pathname || "");
    const lastSegment = pathname.split("/").filter(Boolean).pop() || "";
    return lastSegment || value;
  } catch (_) {
    const clean = value.split("?")[0].split("#")[0];
    return clean.split("/").filter(Boolean).pop() || clean;
  }
}

function refreshBrandFileHints() {
  const logoName = getAssetDisplayName(brandLogoUrlInput?.value || CURRENT_COMPANY_CONFIG?.logoUrl || "");
  if (logoName) {
    setBrandFileHint(brandLogoFileHint, `Activo: ${logoName}`, "muted");
  } else {
    setBrandFileHint(brandLogoFileHint, "Sin archivo cargado.", "muted");
  }

  const backgroundName = getAssetDisplayName(brandBackgroundUrlInput?.value || "");
  const targetLabel = BRAND_BACKGROUND_TARGETS[getSelectedBackgroundTarget()] || "la seccion actual";
  if (backgroundName) {
    setBrandFileHint(brandBackgroundFileHint, `Activo para ${targetLabel}: ${backgroundName}`, "muted");
  } else {
    setBrandFileHint(brandBackgroundFileHint, `Sin fondo cargado para ${targetLabel}.`, "muted");
  }

  Object.entries(BRAND_PORTAL_CARD_INPUTS).forEach(([role, inputs]) => {
    const fileName = getAssetDisplayName(inputs.imageUrl?.value || "");
    const roleLabel = role === "client" ? "Cliente" : role === "employee" ? "Empleado" : "Jefe";
    if (fileName) {
      setBrandFileHint(inputs.imageHint, `Activo para ${roleLabel}: ${fileName}`, "muted");
    } else {
      setBrandFileHint(inputs.imageHint, `Sin imagen cargada para ${roleLabel}.`, "muted");
    }
  });
}

function cloneBrandBackgrounds(configInput) {
  const config = mergeCompanyConfig(configInput || {});
  return JSON.parse(JSON.stringify(config.backgrounds || {}));
}

function slugifyCategoryKey(value) {
  return String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function cloneBrandCategories(configInput) {
  const config = mergeCompanyConfig(configInput || {});
  return JSON.parse(JSON.stringify(config.serviceCategories || []));
}

function syncCategoryDraftsFromDom(options = {}) {
  if (!brandCategoryList) return BRAND_CATEGORY_DRAFTS;
  const { autofillKeys = false } = options;
  const rows = Array.from(brandCategoryList.querySelectorAll("[data-category-row]"));
  BRAND_CATEGORY_DRAFTS = rows.map((row, index) => {
    const labelInput = row.querySelector('[data-category-field="label"]');
    const keyInput = row.querySelector('[data-category-field="key"]');
    const iconInput = row.querySelector('[data-category-field="icon"]');
    const rawLabel = String(labelInput?.value || "").trim();
    const nextKey = slugifyCategoryKey(String(keyInput?.value || "").trim() || (autofillKeys ? rawLabel : ""));

    if (autofillKeys && keyInput && nextKey) {
      keyInput.value = nextKey;
    }

    return {
      key: nextKey || `categoria-${index + 1}`,
      label: rawLabel,
      icon: String(iconInput?.value || "").trim(),
    };
  });

  return BRAND_CATEGORY_DRAFTS;
}

function renderCategoryEditor() {
  if (!brandCategoryList) return;
  const categories = Array.isArray(BRAND_CATEGORY_DRAFTS) && BRAND_CATEGORY_DRAFTS.length
    ? BRAND_CATEGORY_DRAFTS
    : cloneBrandCategories(CURRENT_COMPANY_CONFIG);

  if (!categories.length) {
    brandCategoryList.innerHTML = '<div class="brand-file-hint">No hay categorias. Agrega al menos una.</div>';
    return;
  }

  brandCategoryList.innerHTML = categories.map((category, index) => `
    <div class="category-editor-row" data-category-row="${index}">
      <label>
        Clave
        <input type="text" value="${escapeHtml(slugifyCategoryKey(category?.key || ""))}" data-category-field="key" placeholder="electricidad" />
      </label>
      <label>
        Nombre visible
        <input type="text" value="${escapeHtml(String(category?.label || ""))}" data-category-field="label" placeholder="Electricidad" />
      </label>
      <label>
        Icono
        <input type="text" value="${escapeHtml(String(category?.icon || ""))}" data-category-field="icon" placeholder="⚡" />
      </label>
      <button class="btn btn-danger" type="button" data-category-action="remove" data-category-index="${index}">Borrar</button>
    </div>
  `).join("");
}

function populatePortalCardFields(configInput) {
  const cards = normalizePortalCards(configInput?.portalCards, configInput?.portalCards);
  Object.entries(BRAND_PORTAL_CARD_INPUTS).forEach(([role, inputs]) => {
    const card = cards?.[role] || {};
    if (inputs.title) inputs.title.value = String(card.title || "");
    if (inputs.description) inputs.description.value = String(card.description || "");
    if (inputs.ctaLabel) inputs.ctaLabel.value = String(card.ctaLabel || "");
    if (inputs.icon) inputs.icon.value = String(card.icon || "");
    if (inputs.imageUrl) inputs.imageUrl.value = String(card.imageUrl || "");
    autoResizeTextarea(inputs.description);
  });
}

function readPortalCardFields() {
  const raw = {};
  Object.entries(BRAND_PORTAL_CARD_INPUTS).forEach(([role, inputs]) => {
    raw[role] = {
      title: String(inputs.title?.value || "").trim(),
      description: String(inputs.description?.value || "").trim(),
      ctaLabel: String(inputs.ctaLabel?.value || "").trim(),
      icon: String(inputs.icon?.value || "").trim(),
      imageUrl: String(inputs.imageUrl?.value || "").trim(),
    };
  });
  return normalizePortalCards(raw, CURRENT_COMPANY_CONFIG?.portalCards);
}

function getSelectedBackgroundTarget() {
  return String(brandBackgroundTargetInput?.value || "default").trim() || "default";
}

function getSelectedBackgroundFit() {
  const fit = String(brandBackgroundFitInput?.value || "cover").trim().toLowerCase();
  return fit === "contain" ? "contain" : "cover";
}

function getDraftBackgroundEntry(target = getSelectedBackgroundTarget()) {
  const config = mergeCompanyConfig(CURRENT_COMPANY_CONFIG || {});
  const key = String(target || "default").trim() || "default";
  const draftEntry = BRAND_BACKGROUND_DRAFTS?.[key];
  const resolved = resolveCompanyBackground(
    {
      ...config,
      backgrounds: {
        ...(config.backgrounds || {}),
        ...(BRAND_BACKGROUND_DRAFTS || {}),
      },
    },
    key
  );

  return {
    url: String(draftEntry?.url || resolved.url || "").trim(),
    fit: String(draftEntry?.fit || resolved.fit || "cover").trim().toLowerCase() === "contain" ? "contain" : "cover",
  };
}

function syncActiveBackgroundDraft() {
  const target = getSelectedBackgroundTarget();
  BRAND_BACKGROUND_DRAFTS[target] = {
    url: String(brandBackgroundUrlInput?.value || "").trim(),
    fit: getSelectedBackgroundFit(),
  };
}

function populateBackgroundFieldsForTarget() {
  if (!brandBackgroundUrlInput || !brandBackgroundFitInput) return;
  const target = getSelectedBackgroundTarget();
  const entry = getDraftBackgroundEntry(target);
  brandBackgroundUrlInput.value = entry.url;
  brandBackgroundFitInput.value = entry.fit;
}

function refreshBrandPreviews() {
  if (brandLogoPreview) {
    brandLogoPreview.src = String(brandLogoUrlInput?.value || CURRENT_COMPANY_CONFIG?.logoUrl || "").trim();
    brandLogoPreview.alt = String(brandDisplayNameInput?.value || CURRENT_COMPANY_CONFIG?.displayName || "Logo");
  }

  if (brandBackgroundPreview) {
    const backgroundUrl = String(brandBackgroundUrlInput?.value || "").trim();
    const backgroundFit = getSelectedBackgroundFit();
    brandBackgroundPreview.style.backgroundImage = backgroundUrl ? `url("${backgroundUrl}")` : "none";
    brandBackgroundPreview.style.backgroundSize = backgroundFit;
    brandBackgroundPreview.style.backgroundPosition = "center center";
    brandBackgroundPreview.style.backgroundRepeat = "no-repeat";
  }

  refreshBrandFileHints();
}

function autoResizeTextarea(textarea) {
  if (!(textarea instanceof HTMLTextAreaElement)) return;
  const minHeight = Number.parseFloat(window.getComputedStyle(textarea).minHeight) || 0;
  textarea.style.height = "auto";
  textarea.style.height = `${Math.max(textarea.scrollHeight, minHeight)}px`;
}

function syncBrandTextareaHeights() {
  autoResizeTextarea(brandAddressInput);
  autoResizeTextarea(brandEstimateNotesInput);
  Object.values(BRAND_PORTAL_CARD_INPUTS).forEach((inputs) => {
    autoResizeTextarea(inputs.description);
  });
}

function populateBrandConfigForm(configInput) {
  const config = mergeCompanyConfig(configInput || {});
  CURRENT_COMPANY_CONFIG = config;
  BRAND_BACKGROUND_DRAFTS = cloneBrandBackgrounds(config);
  BRAND_CATEGORY_DRAFTS = cloneBrandCategories(config);

  if (brandDisplayNameInput) brandDisplayNameInput.value = config.displayName || "";
  if (brandLegalNameInput) brandLegalNameInput.value = config.legalName || "";
  if (brandTaglineInput) brandTaglineInput.value = config.tagline || "";
  if (brandPhoneInput) brandPhoneInput.value = config.phone || "";
  if (brandEmailInput) brandEmailInput.value = config.email || "";
  if (brandEinInput) brandEinInput.value = config.ein || "";
  if (brandAddressInput) brandAddressInput.value = config.address || "";
  if (brandLogoUrlInput) brandLogoUrlInput.value = config.logoUrl || "";
  if (brandBackgroundTargetInput && !brandBackgroundTargetInput.value) {
    brandBackgroundTargetInput.value = "default";
  }
  populateBackgroundFieldsForTarget();
  if (brandEstimateTitleInput) brandEstimateTitleInput.value = config.estimate?.title || "";
  if (brandEstimateNotesInput) brandEstimateNotesInput.value = config.estimate?.defaultNotes || "";
  populatePortalCardFields(config);
  renderCategoryEditor();

  syncBrandTextareaHeights();
  refreshBrandPreviews();
  applyCompanyBranding(config);
}

function readBrandConfigForm() {
  syncActiveBackgroundDraft();
  syncCategoryDraftsFromDom({ autofillKeys: true });
  const current = mergeCompanyConfig(CURRENT_COMPANY_CONFIG || {});
  const backgrounds = {
    ...(current.backgrounds || {}),
    ...(BRAND_BACKGROUND_DRAFTS || {}),
  };
  const defaultBackground = backgrounds.default?.url || current.backgroundImageUrl || "";

  return {
    displayName: String(brandDisplayNameInput?.value || "").trim(),
    legalName: String(brandLegalNameInput?.value || "").trim(),
    tagline: String(brandTaglineInput?.value || "").trim(),
    phone: String(brandPhoneInput?.value || "").trim(),
    email: String(brandEmailInput?.value || "").trim(),
    ein: String(brandEinInput?.value || "").trim(),
    address: String(brandAddressInput?.value || "").trim(),
    logoUrl: String(brandLogoUrlInput?.value || "").trim(),
    backgroundImageUrl: String(defaultBackground).trim(),
    backgrounds,
    serviceCategories: normalizeServiceCategories(BRAND_CATEGORY_DRAFTS),
    portalCards: readPortalCardFields(),
    estimate: {
      title: String(brandEstimateTitleInput?.value || "").trim(),
      defaultNotes: String(brandEstimateNotesInput?.value || "").trim(),
    },
  };
}

async function fetchNotificationChannelStatuses() {
  const response = await apiFetch("/api/boss/notifications/channels");
  return response?.data && typeof response.data === "object" ? response.data : {};
}

function applyNotificationChannelStatuses(channels = {}) {
  const whatsapp = channels?.whatsapp && typeof channels.whatsapp === "object" ? channels.whatsapp : {};
  const telegram = channels?.telegram && typeof channels.telegram === "object" ? channels.telegram : {};

  const whatsappFormatted = formatWhatsappStatusRow(whatsapp);
  const telegramFormatted = formatTelegramStatusRow(telegram);
  setBrandWhatsappHealth(whatsappFormatted.message, whatsappFormatted.tone);
  setBrandTelegramHealth(telegramFormatted.message, telegramFormatted.tone);

  CURRENT_NOTIFICATION_CHANNELS = { whatsapp, telegram };
  return CURRENT_NOTIFICATION_CHANNELS;
}

async function refreshNotificationChannelStatuses(options = {}) {
  const { silent = false, focus = "all" } = options;

  if (!silent) {
    if (focus === "all" || focus === "whatsapp") {
      setBrandWhatsappHealth("Canal WhatsApp: consultando estado...", "info");
    }
    if (focus === "all" || focus === "telegram") {
      setBrandTelegramHealth("Canal Telegram: consultando estado...", "info");
    }
  }

  try {
    const channels = await fetchNotificationChannelStatuses();
    applyNotificationChannelStatuses(channels);
    updateNotificationProductionSummary(channels);
    return channels;
  } catch (error) {
    console.error("Load notification channel status error", error);
    const message = error?.message || "No se pudo cargar el estado de los canales.";
    if (focus === "all" || focus === "whatsapp") {
      setBrandWhatsappHealth(message, "error");
      setNotifyChannelBadge(notifyWhatsAppReadyBadge, { state: "error", label: "Error" });
    }
    if (focus === "all" || focus === "telegram") {
      setBrandTelegramHealth(message, "error");
      setNotifyChannelBadge(notifyTelegramReadyBadge, { state: "error", label: "Error" });
    }
    setNotifyProductionSummary("Produccion: no se pudo validar el estado actual de los canales.", "error");
    throw error;
  }
}

async function refreshBrandWhatsappStatus(options = {}) {
  return refreshNotificationChannelStatuses({
    ...options,
    focus: "whatsapp",
  });
}

async function refreshBrandTelegramStatus(options = {}) {
  return refreshNotificationChannelStatuses({
    ...options,
    focus: "telegram",
  });
}

async function sendBrandWhatsappTest() {
  if (brandWhatsappTestBtn) brandWhatsappTestBtn.disabled = true;
  setBrandWhatsappHealth("Enviando prueba WhatsApp...", "info");

  try {
    const to = String(brandWhatsappTestToInput?.value || "").trim();
    const response = await apiFetch("/api/boss/notifications/whatsapp/test", {
      method: "POST",
      body: JSON.stringify({
        ...(to ? { to } : {}),
      }),
    });

    const row = response?.data || {};
    const status = String(row.status || "").trim().toLowerCase();
    if (status === "sent") {
      setBrandWhatsappHealth("Prueba WhatsApp enviada correctamente.", "success");
    } else if (status === "simulated" || status === "skipped") {
      const text = String(row.message || "Prueba ejecutada en modo simulado/sin envio real.");
      setBrandWhatsappHealth(text, "info");
    } else {
      setBrandWhatsappHealth(String(row.message || "Prueba ejecutada."), "muted");
    }
    await refreshBrandWhatsappStatus({ silent: true });
  } catch (error) {
    console.error("WhatsApp test send error", error);
    setBrandWhatsappHealth(error?.message || "No se pudo enviar la prueba de WhatsApp.", "error");
  } finally {
    if (brandWhatsappTestBtn) brandWhatsappTestBtn.disabled = false;
  }
}

async function sendBrandTelegramTest() {
  if (brandTelegramTestBtn) brandTelegramTestBtn.disabled = true;
  setBrandTelegramHealth("Enviando prueba Telegram...", "info");

  try {
    const to = String(brandTelegramTestToInput?.value || "").trim();
    const response = await apiFetch("/api/boss/notifications/telegram/test", {
      method: "POST",
      body: JSON.stringify({
        ...(to ? { to } : {}),
      }),
    });

    const row = response?.data || {};
    const status = String(row.status || "").trim().toLowerCase();
    if (status === "sent") {
      setBrandTelegramHealth("Prueba Telegram enviada correctamente.", "success");
    } else if (status === "simulated" || status === "skipped") {
      const text = String(row.message || "Prueba ejecutada en modo simulado/sin envio real.");
      setBrandTelegramHealth(text, "info");
    } else {
      setBrandTelegramHealth(String(row.message || "Prueba ejecutada."), "muted");
    }
    await refreshBrandTelegramStatus({ silent: true });
  } catch (error) {
    console.error("Telegram test send error", error);
    setBrandTelegramHealth(error?.message || "No se pudo enviar la prueba de Telegram.", "error");
  } finally {
    if (brandTelegramTestBtn) brandTelegramTestBtn.disabled = false;
  }
}

function populateNotificationSettingsForm(settingsInput = {}) {
  const data = settingsInput && typeof settingsInput === "object" ? settingsInput : {};
  const whatsapp = data.whatsapp && typeof data.whatsapp === "object" ? data.whatsapp : {};
  const telegram = data.telegram && typeof data.telegram === "object" ? data.telegram : {};
  CURRENT_NOTIFICATION_SETTINGS = JSON.parse(JSON.stringify({
    whatsapp,
    telegram,
  }));

  if (brandWhatsappNumberInput) brandWhatsappNumberInput.value = whatsapp.alertNumber || "";
  if (brandWhatsappTestToInput) brandWhatsappTestToInput.value = "";
  if (notifyWhatsAppTransportInput) notifyWhatsAppTransportInput.value = whatsapp.transport || "noop";
  if (notifyWhatsAppWebhookUrlInput) notifyWhatsAppWebhookUrlInput.value = whatsapp.webhookUrl || "";
  if (notifyWhatsAppWebhookTokenInput) notifyWhatsAppWebhookTokenInput.value = "";
  if (notifyTwilioAccountSidInput) notifyTwilioAccountSidInput.value = whatsapp.twilioAccountSid || "";
  if (notifyTwilioAuthTokenInput) notifyTwilioAuthTokenInput.value = "";
  if (notifyTwilioWhatsAppFromInput) notifyTwilioWhatsAppFromInput.value = whatsapp.twilioWhatsAppFrom || "";
  if (notifyTwilioMessagingServiceSidInput) notifyTwilioMessagingServiceSidInput.value = whatsapp.twilioMessagingServiceSid || "";
  if (notifyTwilioStatusCallbackUrlInput) notifyTwilioStatusCallbackUrlInput.value = whatsapp.twilioStatusCallbackUrl || "";

  if (notifyTelegramTransportInput) notifyTelegramTransportInput.value = telegram.transport || "disabled";
  if (notifyTelegramBotTokenInput) notifyTelegramBotTokenInput.value = "";
  if (notifyTelegramDefaultChatIdInput) notifyTelegramDefaultChatIdInput.value = telegram.defaultChatId || "";
  if (brandTelegramTestToInput) brandTelegramTestToInput.value = "";

  setBrandFileHint(
    notifyWhatsAppWebhookTokenHint,
    whatsapp.hasWebhookToken
      ? `Token webhook guardado: ${whatsapp.webhookTokenMasked || maskConfigValue("token")}`
      : "Token webhook no configurado.",
    whatsapp.hasWebhookToken ? "success" : "muted"
  );
  setBrandFileHint(
    notifyTwilioAuthTokenHint,
    whatsapp.hasTwilioAuthToken
      ? `Auth token Twilio guardado: ${whatsapp.twilioAuthTokenMasked || maskConfigValue("token")}`
      : "Auth token Twilio no configurado.",
    whatsapp.hasTwilioAuthToken ? "success" : "muted"
  );
  setBrandFileHint(
    notifyTelegramBotTokenHint,
    telegram.hasBotToken
      ? `Bot token Telegram guardado: ${telegram.botTokenMasked || maskConfigValue("token")}`
      : "Bot token Telegram no configurado.",
    telegram.hasBotToken ? "success" : "muted"
  );

  syncNotificationTransportVisibility();
  refreshInternalWhatsAppWebhookHint();
}

function readNotificationSettingsForm() {
  const whatsappAlertRaw = String(brandWhatsappNumberInput?.value || "").trim();
  const whatsappAlertNumber = normalizeWhatsappNumber(whatsappAlertRaw);
  if (whatsappAlertRaw && !whatsappAlertNumber) {
    throw new Error("WhatsApp destino alertas invalido. Usa formato internacional, por ejemplo +50255554444.");
  }

  const whatsappWebhookUrl = String(notifyWhatsAppWebhookUrlInput?.value || "").trim();
  if (whatsappWebhookUrl) {
    try {
      new URL(whatsappWebhookUrl);
    } catch (_) {
      throw new Error("Webhook URL invalido.");
    }
  }

  const twilioStatusCallbackUrl = String(notifyTwilioStatusCallbackUrlInput?.value || "").trim();
  if (twilioStatusCallbackUrl) {
    try {
      new URL(twilioStatusCallbackUrl);
    } catch (_) {
      throw new Error("Callback estado Twilio invalido.");
    }
  }

  const payload = {
    whatsapp: {
      transport: String(notifyWhatsAppTransportInput?.value || "noop").trim() || "noop",
      webhookUrl: whatsappWebhookUrl,
      twilioAccountSid: String(notifyTwilioAccountSidInput?.value || "").trim(),
      twilioWhatsAppFrom: String(notifyTwilioWhatsAppFromInput?.value || "").trim(),
      twilioMessagingServiceSid: String(notifyTwilioMessagingServiceSidInput?.value || "").trim(),
      twilioStatusCallbackUrl,
    },
    telegram: {
      transport: String(notifyTelegramTransportInput?.value || "disabled").trim() || "disabled",
      defaultChatId: String(notifyTelegramDefaultChatIdInput?.value || "").trim(),
    },
  };

  if (whatsappAlertNumber) payload.whatsapp.alertNumber = whatsappAlertNumber;

  const webhookToken = String(notifyWhatsAppWebhookTokenInput?.value || "").trim();
  if (webhookToken) payload.whatsapp.webhookToken = webhookToken;

  const twilioAuthToken = String(notifyTwilioAuthTokenInput?.value || "").trim();
  if (twilioAuthToken) payload.whatsapp.twilioAuthToken = twilioAuthToken;

  const telegramBotToken = String(notifyTelegramBotTokenInput?.value || "").trim();
  if (telegramBotToken) payload.telegram.botToken = telegramBotToken;

  return payload;
}

async function loadNotificationSettings() {
  if (!notifyStatus) return;
  setNotifyStatus("Cargando configuracion de notificaciones...", "info");
  setNotifyProductionSummary("Produccion: evaluando configuracion de canales...", "muted");
  try {
    const response = await apiFetch("/api/boss/notifications/settings");
    populateNotificationSettingsForm(response?.data || {});
    await refreshNotificationChannelStatuses({ silent: true });
    setNotifyStatus("Canales listos para editar. Usa Configurar produccion cuando termines de llenar el canal que si vas a usar.", "muted");
  } catch (error) {
    console.error("Load notification settings error", error);
    setNotifyStatus(error?.message || "No se pudo cargar la configuracion de notificaciones.", "error");
    setNotifyProductionSummary("Produccion: no se pudo cargar la configuracion actual.", "error");
  }
}

async function saveNotificationSettings(options = {}) {
  if (!notifySaveBtn) return;
  const { mode = "save" } = options;
  const isProductionMode = mode === "production";
  let payload;
  try {
    payload = readNotificationSettingsForm();
    if (isProductionMode) {
      payload = prepareNotificationSettingsForProduction(payload);
    }
  } catch (error) {
    const message = error?.message || "Revisa los datos de notificaciones antes de guardar.";
    setNotifyStatus(message, "error");
    alert(message);
    return null;
  }

  if (notifyWhatsAppTransportInput) notifyWhatsAppTransportInput.value = payload.whatsapp?.transport || "noop";
  if (notifyTelegramTransportInput) notifyTelegramTransportInput.value = payload.telegram?.transport || "disabled";
  syncNotificationTransportVisibility();

  notifySaveBtn.disabled = true;
  if (notifyConfigureBtn) notifyConfigureBtn.disabled = true;
  setNotifyStatus(
    isProductionMode
      ? "Guardando cambios y validando produccion..."
      : "Guardando canales de notificacion...",
    "info"
  );

  try {
    const response = await apiFetch("/api/boss/notifications/settings", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    populateNotificationSettingsForm(response?.data || {});
    const channels = await refreshNotificationChannelStatuses({ silent: true });
    const summary = summarizeNotificationProduction(channels);

    if (isProductionMode) {
      setNotifyStatus(
        summary.allActiveReady
          ? "Configuracion guardada y lista para produccion."
          : summary.message,
        summary.allActiveReady ? "success" : summary.tone
      );
    } else {
      setNotifyStatus(
        "Canales guardados. Usa Configurar produccion para validar el estado final del canal activo.",
        "success"
      );
    }
    return { response, channels, summary };
  } catch (error) {
    console.error("Save notification settings error", error);
    setNotifyStatus(error?.message || "No se pudo guardar la configuracion de notificaciones.", "error");
    return null;
  } finally {
    notifySaveBtn.disabled = false;
    if (notifyConfigureBtn) notifyConfigureBtn.disabled = false;
  }
}

function applyInternalWhatsAppWebhookPreset() {
  if (notifyWhatsAppTransportInput) notifyWhatsAppTransportInput.value = "webhook";
  if (notifyWhatsAppWebhookUrlInput) notifyWhatsAppWebhookUrlInput.value = getInternalWhatsAppWebhookUrl();
  if (notifyWhatsAppWebhookTokenInput && !hasTextValue(notifyWhatsAppWebhookTokenInput.value)) {
    notifyWhatsAppWebhookTokenInput.value = generateWebhookSecret();
  }

  syncNotificationTransportVisibility();
  refreshInternalWhatsAppWebhookHint();
  setNotifyStatus(
    "Webhook interno cargado. Guarda cambios. Si llenas tambien Twilio, el webhook interno podra reenviar mensajes reales.",
    "info"
  );
  setNotifyProductionSummary(
    "Produccion: webhook interno preparado en el formulario. Guarda o usa Configurar produccion para dejarlo activo.",
    "muted"
  );
}

function bindNotificationSettingsEvents() {
  if (!notifyStatus || notifyStatus.dataset.bound === "1") return;

  const markNotificationDraftDirty = () => {
    setNotifyStatus("Hay cambios pendientes en canales de notificacion.", "muted");
    setNotifyProductionSummary("Produccion: hay cambios sin guardar. Guarda o usa Configurar produccion para validar otra vez.", "muted");
    refreshInternalWhatsAppWebhookHint();
  };

  const trackedInputs = [
    brandWhatsappNumberInput,
    brandWhatsappTestToInput,
    notifyWhatsAppTransportInput,
    notifyWhatsAppWebhookUrlInput,
    notifyWhatsAppWebhookTokenInput,
    notifyTwilioAccountSidInput,
    notifyTwilioAuthTokenInput,
    notifyTwilioWhatsAppFromInput,
    notifyTwilioMessagingServiceSidInput,
    notifyTwilioStatusCallbackUrlInput,
    notifyTelegramTransportInput,
    notifyTelegramBotTokenInput,
    notifyTelegramDefaultChatIdInput,
    brandTelegramTestToInput,
  ];

  trackedInputs.forEach((input) => {
    input?.addEventListener("input", markNotificationDraftDirty);
    input?.addEventListener("change", markNotificationDraftDirty);
  });

  brandWhatsappNumberInput?.addEventListener("blur", () => {
    const normalized = normalizeWhatsappNumber(brandWhatsappNumberInput.value);
    const hasTypedValue = String(brandWhatsappNumberInput.value || "").trim().length > 0;
    if (!hasTypedValue) return;
    if (!normalized) {
      setNotifyStatus("WhatsApp destino alertas invalido. Ejemplo: +50255554444.", "error");
      return;
    }
    brandWhatsappNumberInput.value = normalized;
    setNotifyStatus("WhatsApp destino normalizado. Recuerda guardar canales.", "info");
  });

  notifyWhatsAppTransportInput?.addEventListener("change", () => {
    syncNotificationTransportVisibility();
    refreshInternalWhatsAppWebhookHint();
  });

  notifyTelegramTransportInput?.addEventListener("change", () => {
    syncNotificationTransportVisibility();
  });

  notifyWhatsAppUseInternalWebhookBtn?.addEventListener("click", () => {
    applyInternalWhatsAppWebhookPreset();
  });

  brandWhatsappStatusBtn?.addEventListener("click", () => {
    refreshBrandWhatsappStatus().catch(() => {});
  });

  brandWhatsappTestBtn?.addEventListener("click", () => {
    sendBrandWhatsappTest();
  });

  brandTelegramStatusBtn?.addEventListener("click", () => {
    refreshBrandTelegramStatus().catch(() => {});
  });

  brandTelegramTestBtn?.addEventListener("click", () => {
    sendBrandTelegramTest();
  });

  notifySaveBtn?.addEventListener("click", () => {
    saveNotificationSettings({ mode: "save" });
  });

  notifyConfigureBtn?.addEventListener("click", () => {
    saveNotificationSettings({ mode: "production" });
  });

  notifyResetBtn?.addEventListener("click", () => {
    populateNotificationSettingsForm(CURRENT_NOTIFICATION_SETTINGS || {});
    setNotifyStatus("Cambios locales de canales descartados.", "muted");
    refreshNotificationChannelStatuses({ silent: true }).catch(() => {});
  });

  syncNotificationTransportVisibility();
  refreshInternalWhatsAppWebhookHint();
  notifyStatus.dataset.bound = "1";
}

async function loadBrandConfig(force = false) {
  if (!brandDisplayNameInput) return;
  setBrandStatus("Cargando configuracion de empresa...", "info");
  const config = await loadCompanyConfig({ force });
  populateBrandConfigForm(config);
  setBrandStatus("Configuracion lista.", "muted");
}

async function uploadBrandAsset(fileInput, urlInput, label) {
  const file = fileInput?.files?.[0];
  if (!file) return;

  try {
    const pendingMessage = `Seleccionado: ${file.name}`;
    if (label === "logo") setBrandFileHint(brandLogoFileHint, pendingMessage, "info");
    if (label === "fondo") setBrandFileHint(brandBackgroundFileHint, pendingMessage, "info");

    setBrandStatus(`Subiendo ${label}...`, "info");
    const result = await uploadImage(file);
    if (urlInput) urlInput.value = result?.url || "";
    if (label === "fondo") {
      syncActiveBackgroundDraft();
    }
    refreshBrandPreviews();
    setBrandStatus(`${label} cargado. Guardando configuracion...`, "info");
    await saveBrandConfig({ skipStatus: true });
    setBrandStatus(`${label} actualizado y aplicado globalmente.`, "success");
    if (label === "logo") {
      setBrandFileHint(
        brandLogoFileHint,
        `Subido: ${file.name}. El selector se limpia para permitir volver a elegir el mismo archivo.`,
        "success"
      );
    }
    if (label === "fondo") {
      setBrandFileHint(
        brandBackgroundFileHint,
        `Subido: ${file.name}. El selector se limpia para permitir volver a elegir el mismo archivo.`,
        "success"
      );
    }
  } catch (error) {
    console.error(`Upload ${label} error`, error);
    const message = error?.message || `No se pudo subir ${label.toLowerCase()}.`;
    setBrandStatus(message, "error");
    if (label === "logo") setBrandFileHint(brandLogoFileHint, message, "error");
    if (label === "fondo") setBrandFileHint(brandBackgroundFileHint, message, "error");
    alert(message);
  } finally {
    if (fileInput) fileInput.value = "";
  }
}

async function uploadPortalCardAsset(role) {
  const inputs = BRAND_PORTAL_CARD_INPUTS?.[role];
  const file = inputs?.imageFile?.files?.[0];
  if (!inputs || !file) return;

  const roleLabel = role === "client" ? "Cliente" : role === "employee" ? "Empleado" : "Jefe";
  try {
    setBrandFileHint(inputs.imageHint, `Seleccionado para ${roleLabel}: ${file.name}`, "info");
    setBrandStatus(`Subiendo imagen de ${roleLabel.toLowerCase()}...`, "info");
    const result = await uploadImage(file);
    if (inputs.imageUrl) inputs.imageUrl.value = result?.url || "";
    refreshBrandPreviews();
    setBrandStatus(`Imagen de ${roleLabel.toLowerCase()} cargada. Guardando configuracion...`, "info");
    await saveBrandConfig({ skipStatus: true });
    setBrandFileHint(inputs.imageHint, `Subido para ${roleLabel}: ${file.name}`, "success");
    setBrandStatus(`Tarjeta de ${roleLabel.toLowerCase()} actualizada.`, "success");
  } catch (error) {
    console.error(`Upload portal card image error (${role})`, error);
    const message = error?.message || `No se pudo subir la imagen de ${roleLabel.toLowerCase()}.`;
    setBrandFileHint(inputs.imageHint, message, "error");
    setBrandStatus(message, "error");
    alert(message);
  } finally {
    if (inputs.imageFile) inputs.imageFile.value = "";
  }
}

async function saveBrandConfig(options = {}) {
  if (!brandSaveBtn) return;
  const { skipStatus = false } = options;

  let payload;
  try {
    payload = readBrandConfigForm();
  } catch (error) {
    const message = error?.message || "Revisa los datos de configuracion antes de guardar.";
    setBrandStatus(message, "error");
    alert(message);
    return;
  }
  brandSaveBtn.disabled = true;
  if (!skipStatus) setBrandStatus("Guardando configuracion...", "info");

  try {
    const response = await apiFetch("/api/boss/company-config", {
      method: "PUT",
      body: JSON.stringify(payload),
    });

    const config = mergeCompanyConfig(response?.data || response || payload);
    CURRENT_COMPANY_CONFIG = config;
    cacheCompanyConfig(config);
    populateBrandConfigForm(config);
    setBrandStatus("Configuracion guardada. La marca ya queda disponible para el portal y los estimados.", "success");
  } catch (error) {
    console.error("Save company config error", error);
    setBrandStatus(error?.message || "No se pudo guardar la configuracion.", "error");
    throw error;
  } finally {
    brandSaveBtn.disabled = false;
  }
}

function bindBrandConfigEvents() {
  if (!brandDisplayNameInput || brandDisplayNameInput.dataset.bound === "1") return;

  [
    brandDisplayNameInput,
    brandLegalNameInput,
    brandTaglineInput,
    brandPhoneInput,
    brandEmailInput,
    brandEinInput,
    brandAddressInput,
    brandLogoUrlInput,
    brandEstimateTitleInput,
    brandEstimateNotesInput,
  ].forEach((input) => {
    input?.addEventListener("input", () => {
      autoResizeTextarea(input);
      refreshBrandPreviews();
      setBrandStatus("Hay cambios pendientes por guardar.", "muted");
    });
  });

  Object.values(BRAND_PORTAL_CARD_INPUTS).forEach((inputs) => {
    [inputs.title, inputs.description, inputs.ctaLabel, inputs.icon, inputs.imageUrl].forEach((input) => {
      input?.addEventListener("input", () => {
        autoResizeTextarea(input);
        setBrandStatus("Hay cambios pendientes por guardar.", "muted");
      });
    });

    inputs.imageFile?.addEventListener("change", () => {
      const role = Object.entries(BRAND_PORTAL_CARD_INPUTS).find(([, candidate]) => candidate === inputs)?.[0];
      if (role) {
        uploadPortalCardAsset(role);
      }
    });
  });

  brandBackgroundTargetInput?.addEventListener("change", () => {
    populateBackgroundFieldsForTarget();
    refreshBrandPreviews();
    const targetLabel = BRAND_BACKGROUND_TARGETS[getSelectedBackgroundTarget()] || "la seccion seleccionada";
    setBrandStatus(`Editando fondo para ${targetLabel}.`, "info");
  });

  brandBackgroundUrlInput?.addEventListener("input", () => {
    syncActiveBackgroundDraft();
    refreshBrandPreviews();
    setBrandStatus("Hay cambios pendientes por guardar.", "muted");
  });

  brandBackgroundFitInput?.addEventListener("change", () => {
    syncActiveBackgroundDraft();
    refreshBrandPreviews();
    setBrandStatus("Hay cambios pendientes por guardar.", "muted");
  });

  brandLogoFileInput?.addEventListener("change", () => {
    uploadBrandAsset(brandLogoFileInput, brandLogoUrlInput, "logo");
  });

  brandBackgroundFileInput?.addEventListener("change", () => {
    uploadBrandAsset(brandBackgroundFileInput, brandBackgroundUrlInput, "fondo");
  });

  brandAddCategoryBtn?.addEventListener("click", () => {
    syncCategoryDraftsFromDom({ autofillKeys: true });
    const currentCategories = Array.isArray(BRAND_CATEGORY_DRAFTS)
      ? BRAND_CATEGORY_DRAFTS.filter((entry) => String(entry?.label || entry?.key || "").trim())
      : [];
    const nextIndex = (BRAND_CATEGORY_DRAFTS?.length || 0) + 1;
    BRAND_CATEGORY_DRAFTS = [
      ...(currentCategories.length ? normalizeServiceCategories(currentCategories) : []),
      {
        key: `categoria-${nextIndex}`,
        label: `Nueva categoria ${nextIndex}`,
        icon: "🛠️",
      },
    ];
    renderCategoryEditor();
    setBrandStatus("Nueva categoria agregada. Guarda cambios para publicarla.", "info");
  });

  brandCategoryList?.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    const row = target.closest("[data-category-row]");
    if (!row) return;

    if (target.dataset.categoryField === "key") {
      target.value = slugifyCategoryKey(target.value);
    } else if (target.dataset.categoryField === "label") {
      const keyInput = row.querySelector('[data-category-field="key"]');
      if (keyInput instanceof HTMLInputElement && !String(keyInput.value || "").trim()) {
        keyInput.value = slugifyCategoryKey(target.value);
      }
    }

    syncCategoryDraftsFromDom();
    setBrandStatus("Hay cambios pendientes por guardar.", "muted");
  });

  brandCategoryList?.addEventListener("click", (event) => {
    const button = event.target instanceof Element ? event.target.closest("[data-category-action]") : null;
    if (!(button instanceof HTMLButtonElement)) return;
    const action = String(button.dataset.categoryAction || "").trim();
    if (action !== "remove") return;

    syncCategoryDraftsFromDom({ autofillKeys: true });
    const index = Number(button.dataset.categoryIndex);
    BRAND_CATEGORY_DRAFTS = BRAND_CATEGORY_DRAFTS.filter((_, itemIndex) => itemIndex !== index);
    renderCategoryEditor();
    setBrandStatus("Categoria eliminada. Guarda cambios para publicarla.", "info");
  });

  brandSaveBtn?.addEventListener("click", () => {
    saveBrandConfig();
  });

  brandResetBtn?.addEventListener("click", () => {
    populateBrandConfigForm(CURRENT_COMPANY_CONFIG);
    setBrandStatus("Cambios locales descartados.", "muted");
  });

  syncBrandTextareaHeights();
  brandDisplayNameInput.dataset.bound = "1";
}

// ====== ACCIONES JEFE ======

window.forceRelease = async (docId) => {
  const ok = confirm("¿Seguro que querés desasignar esta solicitud? Volverá a EN_ESPERA.");
  if (!ok) return;

  const ref = doc(db, "requests", docId);

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error("No existe.");

      const d = snap.data();
      const st = String(d.status || "EN_ESPERA").toUpperCase();
      if (st === "COMPLETADO") throw new Error("No se puede desasignar una solicitud completada.");

      const auditTrail = Array.isArray(d.auditTrail) ? d.auditTrail.slice(-24) : [];
      auditTrail.push({
        action: "force-update",
        byUid: CURRENT_USER?.uid || "",
        byRole: "boss",
        at: new Date().toISOString(),
        payloadSummary: {
          status: "EN_ESPERA",
          assignedTo: null,
        },
      });

      tx.update(ref, {
        status: "EN_ESPERA",
        assignedEmployeeId: null,
        employeeEmail: null,
        employeeName: null,
        assignedAt: null,
        proposal: null,
        updatedAt: serverTimestamp(),
        auditTrail,
      });
    });
  } catch (e) {
    console.error("forceRelease error:", e);
    alert(e?.message || "Error liberando.");
  }
};

window.forceDone = async (docId) => {
  const ok = confirm("¿Seguro que querés forzar el cierre? Quedará como COMPLETADO.");
  if (!ok) return;

  const ref = doc(db, "requests", docId);

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error("No existe.");

      const d = snap.data();
      const st = String(d.status || "EN_ESPERA").toUpperCase();
      if (st === "COMPLETADO") throw new Error("Ya está completada.");

      const auditTrail = Array.isArray(d.auditTrail) ? d.auditTrail.slice(-24) : [];
      auditTrail.push({
        action: "force-close",
        byUid: CURRENT_USER?.uid || "",
        byRole: "boss",
        at: new Date().toISOString(),
        payloadSummary: {
          status: "COMPLETADO",
          assignedTo: d.assignedEmployeeId || null,
        },
      });

      tx.update(ref, {
        status: "COMPLETADO",
        bossApprovedAt: serverTimestamp(),
        bossApprovedBy: CURRENT_USER?.uid || null,
        updatedAt: serverTimestamp(),
        auditTrail,
      });
    });
  } catch (e) {
    console.error("forceDone error:", e);
    alert(e?.message || "Error forzando done.");
  }
};

window.approvePaymentReq = async (id) => {
  const ok = confirm("¿Confirmas que el pago es válido? Esto finalizará la solicitud.");
  if (!ok) return;

  try {
    await apiFetch(`/api/marketplace/requests/${id}/approve-payment`, {
      method: "POST"
    });
    alert("✅ Pago aprobado y solicitud finalizada.");
    const idx = CACHE.findIndex(x => x.id === id);
    if (idx >= 0) {
      CACHE[idx] = {
        ...CACHE[idx],
        data: {
          ...CACHE[idx].data,
          status: "COMPLETADO"
        }
      };
    }
    render();
    loadEarnings(); // Refresh earnings after approval
    await fetchReviewQueue({ silent: true });
  } catch (e) {
    console.error("approvePayment error", e);
    alert("❌ Error aprobando pago: " + (e.message || e.status));
  }
};

window.rejectPaymentReq = async (id) => {
  const requestId = normalizeName(id);
  if (!requestId) return;

  const reasonRaw = prompt("Motivo del rechazo (opcional).");
  if (reasonRaw === null) return;
  const reason = normalizeName(reasonRaw).slice(0, 300);
  const ok = confirm("¿Rechazar este comprobante y solicitar uno nuevo?");
  if (!ok) return;

  try {
    const res = await apiFetch(`/api/marketplace/requests/${requestId}/reject-payment`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
    alert("✅ Comprobante rechazado. Se pidió nuevo comprobante.");
    const updated = res?.data;
    const idx = CACHE.findIndex(x => x.id === requestId);
    if (idx >= 0 && updated) {
      CACHE[idx] = {
        ...CACHE[idx],
        data: {
          ...CACHE[idx].data,
          ...updated,
        }
      };
    }
    render();
    await fetchReviewQueue({ silent: true });
  } catch (e) {
    console.error("rejectPayment error", e);
    alert("❌ Error rechazando pago: " + (e.message || e.status));
  }
};

// ===== EARNINGS =====
let EARNINGS_HISTORY = [];
let HISTORY_VISIBLE = false;

function getEmployeePaymentHistory() {
  const requestRows = CACHE
    .map((entry) => {
      const requestId = normalizeName(entry?.id);
      const req = entry?.data || {};
      const eventDate = normalizeAuditDate(req.paymentProofAt || req.bossApprovedAt || req.updatedAt || req.createdAt);
      const assignedEmployeeId = normalizeName(req.assignedEmployeeId);
      const finalAmount = Number(req.finalAmount);
      const status = normalizeName(req.status).toUpperCase();
      const commissionAmount = Math.round(finalAmount * BOSS_COMMISSION_RATE * 100) / 100;

      if (!requestId || !eventDate) return null;
      if (!Number.isFinite(finalAmount) || finalAmount <= 0) return null;
      if (!["PAGO_PENDIENTE_REVISION", "COMPLETADO"].includes(status)) return null;

      return {
        id: requestId,
        requestId,
        finalAmount,
        commissionAmount,
        employeeId: assignedEmployeeId,
        employeeName: normalizeName(req.employeeName),
        employeeEmail: normalizeName(req.employeeEmail),
        description: normalizeName(req.description),
        address: normalizeName(req.address),
        createdAt: eventDate,
        status: status || "PAGO_PENDIENTE_REVISION",
        sourceType: "request",
      };
    })
    .filter(Boolean);

  const emergencyRows = EMERGENCY_CALLS_CACHE
    .map((call) => {
      const callId = normalizeName(call?.id);
      const eventDate = normalizeAuditDate(
        call?.paymentProofAt
        || call?.paymentProofAtMs
        || call?.bossApprovedAt
        || call?.bossApprovedAtMs
        || call?.updatedAt
        || call?.updatedAtMs
      );
      const assignedEmployeeId = normalizeName(call?.assignedEmployeeId);
      const finalAmount = Number(call?.finalAmount ?? call?.quotedAmount);
      const status = normalizeEmergencyStatusForBoss(call?.status);
      const commissionAmount = Math.round(finalAmount * BOSS_COMMISSION_RATE * 100) / 100;

      if (!callId || !eventDate) return null;
      if (!Number.isFinite(finalAmount) || finalAmount <= 0) return null;
      if (!["PAGO_PENDIENTE_REVISION", "COMPLETADO"].includes(status)) return null;

      return {
        id: `emergency:${callId}`,
        requestId: callId,
        finalAmount,
        commissionAmount,
        employeeId: assignedEmployeeId,
        employeeName: normalizeName(call?.assignedEmployeeName),
        employeeEmail: normalizeName(call?.assignedEmployeeEmail),
        description: normalizeName(call?.description),
        address: normalizeName(call?.address),
        createdAt: eventDate,
        status,
        sourceType: "emergency",
      };
    })
    .filter(Boolean);

  const rows = [...requestRows, ...emergencyRows]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return rows;
}

function loadEarnings() {
  const setTxt = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  const history = getEmployeePaymentHistory();
  const { todayTotal, allTotal } = computeCommissionTotals(history);

  setTxt("eToday", `$${todayTotal.toLocaleString()}`);
  setTxt("eAll", `$${allTotal.toLocaleString()}`);

  EARNINGS_HISTORY = history.slice(0, 100);
  ensureEmployeeNames(EARNINGS_HISTORY).then(() => {
    renderHistory();
  }).catch(() => {
    renderHistory();
  });

  renderSystemDashboard();
}

function renderHistory() {
  const historyList = document.getElementById("historyList");
  if (!historyList) return;

  if (EARNINGS_HISTORY.length === 0) {
    historyList.innerHTML = '<div style="opacity:.6; padding:20px; text-align:center;">No hay comprobantes de pago enviados por empleados todavía.</div>';
    return;
  }

  historyList.innerHTML = EARNINGS_HISTORY.map(e => {
    const date = e.createdAt ? new Date(e.createdAt).toLocaleString() : '—';
    const sourceLabel = e.sourceType === "emergency" ? "Emergencia" : "Solicitud";
    const gross = Number(e.finalAmount || 0);
    const commission = Number(e.commissionAmount || 0);
    return `
      <div style="background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.15); border-radius:12px; padding:12px;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
          <div>
            <span style="color:#22c55e; font-weight:900; font-size:1.1rem;">$${commission.toLocaleString()}</span>
            <span style="opacity:.6; margin-left:8px;">Comisión 20% (${sourceLabel})</span>
          </div>
          <span style="opacity:.7; font-size:.85rem;">${date}</span>
        </div>
        <div style="margin-top:6px; opacity:.85; font-size:.9rem;">
          ${getEmployeeDisplayName(e)} • ${e.description || 'Sin descripción'}
        </div>
        <div style="margin-top:4px; opacity:.68; font-size:.82rem;">
          ${e.address || 'Sin dirección'} • Trabajo: $${gross.toLocaleString()} • ${e.status || 'PAGO_PENDIENTE_REVISION'}
        </div>
      </div>
    `;
  }).join('');
}

window.toggleHistory = () => {
  HISTORY_VISIBLE = !HISTORY_VISIBLE;
  const panel = document.getElementById("historyPanel");
  if (panel) {
    panel.style.display = HISTORY_VISIBLE ? "block" : "none";
  }
};

// ===== CHAT (BOSS) =====
function ensureChatPanel() {
  const panel = document.getElementById("chatPanel");
  if (!panel) return false;
  if (panel.dataset.ready === "1") return true;

  panel.dataset.ready = "1";
  panel.innerHTML = `
      <div class="chat-header">
        <div class="chat-header-copy">
          <div id="chatTitle" class="chat-title">Chat</div>
          <div id="chatMeta" class="chat-meta"></div>
        </div>
        <button id="chatClose" class="chat-close-btn" type="button">Cerrar</button>
      </div>
      <div class="chat-profiles">
        <div class="chat-profile">
          <div class="chat-profile-title">Cliente</div>
          <div id="chatClient" class="chat-profile-body">-</div>
        </div>
        <div class="chat-profile">
          <div class="chat-profile-title">Empleado</div>
          <div id="chatEmployee" class="chat-profile-body">-</div>
        </div>
      </div>
      <img id="chatPhoto" class="chat-photo hidden" alt="Job photo" />
      <div id="chatMessages" class="chat-messages"></div>
      <div id="chatError" class="chat-error"></div>
      <div class="chat-input-row">
        <input id="chatInput" type="text" placeholder="Escribe un mensaje" maxlength="2000" autocomplete="off" />
        <button id="chatSend" class="chat-send-btn" type="button" aria-label="Enviar mensaje">&gt;</button>
      </div>
      <div id="chatCooldown" class="chat-cooldown"></div>
    `;

  document.getElementById("chatClose").addEventListener("click", closeChat);
  document.getElementById("chatSend").addEventListener("click", sendChat);
  document.getElementById("chatInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendChat();
  });
  return true;
}

window.openChat = async (requestId, isInternal = false) => {
  const cached = CACHE.find(x => x.id === requestId);
  if (!cached) return;
  if (!ensureChatPanel()) return;

  CHAT_REQUEST_ID = requestId;
  CHAT_IS_INTERNAL = !!isInternal;

  const req = cached.data;
  await ensureEmployeeNames([req]);
  const status = String(req.status || "").toUpperCase();
  const publicAllowed = CHAT_ALLOWED_STATUSES.includes(status);
  CHAT_CAN_SEND = CHAT_IS_INTERNAL || publicAllowed;
  CHAT_SEND_REASON = CHAT_CAN_SEND
    ? ""
    : "Chat disponible solo cuando la solicitud esta en: ASIGNADO, NEGOCIANDO, EN PROCESO o ESPERANDO CIERRE CLIENTE.";
  const headerTitle = document.getElementById("chatTitle");
  const headerMeta = document.getElementById("chatMeta");
  const panel = document.getElementById("chatPanel");

  if (CHAT_IS_INTERNAL) {
    headerTitle.textContent = "CHAT PRIVADO (JEFE-EMPLEADO)";
    headerMeta.textContent = "Solo visible para Jefe y Empleado.";
    panel.classList.add("internal-mode");
  } else {
    headerTitle.textContent = "Chat Cliente-Empleado";
    headerMeta.textContent = "Canal compartido: Cliente, Empleado y Jefe";
    panel.classList.remove("internal-mode");
  }

  const chatClient = document.getElementById("chatClient");
  const chatEmployee = document.getElementById("chatEmployee");

  chatClient.innerHTML = `
    <span class="chat-name">${escapeHtml(req.clientNickname || "Cliente")}</span>
    <span class="chat-email">${escapeHtml(req.clientEmail || "-")}</span>
  `;
  chatEmployee.innerHTML = `
    <span class="chat-name">${escapeHtml(getEmployeeDisplayName(req))}</span>
    <span class="chat-email">${escapeHtml(req.employeeEmail || "-")}</span>
  `;

  chatClient.classList.toggle("muted", CHAT_IS_INTERNAL);

  const photoEl = document.getElementById("chatPhoto");
  if (photoEl) {
    if (req.photoUrl) {
      photoEl.src = req.photoUrl;
      photoEl.classList.remove("hidden");
    } else {
      photoEl.classList.add("hidden");
      photoEl.removeAttribute("src");
    }
  }

  const msgBox = document.getElementById("chatMessages");
  msgBox.innerHTML = "<div class='meta'>Cargando mensajes...</div>";
  const errorEl = document.getElementById("chatError");
  errorEl.textContent = CHAT_SEND_REASON;

  const inputEl = document.getElementById("chatInput");
  const sendBtn = document.getElementById("chatSend");
  if (inputEl && sendBtn) {
    inputEl.disabled = !CHAT_CAN_SEND;
    sendBtn.disabled = !CHAT_CAN_SEND;
    inputEl.placeholder = CHAT_CAN_SEND ? "Escribe un mensaje" : "Chat no habilitado en este estado";
  }

  panel.classList.remove("hidden");
  panel.classList.add("visible");

  try {
    await loadChatMessages();
    renderChatMessages();
    startChatPolling();
  } catch (e) {
    console.error("[chat] Load error", e);
    document.getElementById("chatError").textContent = e?.message || "Error al cargar mensajes.";
  }
};

function closeChat() {
  stopChatPolling();
  CHAT_REQUEST_ID = null;
  CHAT_IS_INTERNAL = false;
  CHAT_MESSAGES = [];
  CHAT_CAN_SEND = true;
  CHAT_SEND_REASON = "";
  const panel = document.getElementById("chatPanel");
  if (panel) {
    panel.classList.add("hidden");
    panel.classList.remove("visible");
    panel.classList.remove("internal-mode");
  }
}

async function loadChatMessages() {
  if (!CHAT_REQUEST_ID) return;
  const res = await apiFetch(`/api/marketplace/requests/${CHAT_REQUEST_ID}/chat?limit=80`);
  CHAT_MESSAGES = res.data || [];
}

function renderChatMessages() {
  const box = document.getElementById("chatMessages");
  if (!box) return;

  const visible = CHAT_IS_INTERNAL
    ? CHAT_MESSAGES.filter(m => m.isInternal)
    : CHAT_MESSAGES.filter(m => !m.isInternal);

  if (visible.length === 0) {
    box.innerHTML = "<div class='meta'>No hay mensajes aun.</div>";
    return;
  }

  box.innerHTML = visible.map(msg => {
    const mine = CURRENT_USER && msg.senderId === CURRENT_USER.uid;
    const isInternalMsg = msg.isInternal;

    let bubbleClass = "bubble";
    let metaPrefix = "";
    if (isInternalMsg) {
      bubbleClass += " internal-msg";
      metaPrefix = "PRIVADO - ";
    }

    const safeText = msg.text ? escapeHtml(msg.text) : "";
    let attachmentHtml = "";
    if (Array.isArray(msg.attachments) && msg.attachments.length > 0) {
      attachmentHtml = `<div class="chat-attachments">` +
        msg.attachments.map(url => `
             <a href="${url}" target="_blank">
               <img src="${url}" class="chat-thumb">
             </a>`).join("") +
        `</div>`;
    }

    return `
      <div class="chat-msg ${mine ? 'right' : 'left'}">
        <div class="${bubbleClass}">
          ${safeText}
          ${attachmentHtml}
        </div>
        <div class="meta">${metaPrefix}${fmtDate(msg.createdAt)}</div>
      </div>
    `;
  }).join("");

  box.scrollTop = box.scrollHeight;
}

async function sendChat() {
  const input = document.getElementById("chatInput");
  const text = input.value.trim();
  if (!text || !CHAT_REQUEST_ID) return;
  if (!CHAT_CAN_SEND) {
    const errEl = document.getElementById("chatError");
    if (errEl) errEl.textContent = CHAT_SEND_REASON || "Chat no habilitado en este estado.";
    return;
  }
  if (Date.now() - CHAT_LAST_SENT < 1200) return;

  input.value = "";

  try {
    await apiFetch(`/api/marketplace/requests/${CHAT_REQUEST_ID}/chat`, {
      method: "POST",
      body: JSON.stringify({
        text,
        isInternal: CHAT_IS_INTERNAL
      })
    });
    CHAT_LAST_SENT = Date.now();
    await loadChatMessages();
    renderChatMessages();
  } catch (e) {
    console.error("Send chat error", e);
    document.getElementById("chatError").textContent = e?.message || "Error enviando mensaje.";
  }
}

function startChatPolling() {
  stopChatPolling();
  CHAT_POLL_TIMER = setInterval(async () => {
    if (!CHAT_REQUEST_ID) return;
    await loadChatMessages();
    renderChatMessages();
  }, 4000);
}

function stopChatPolling() {
  if (CHAT_POLL_TIMER) {
    clearInterval(CHAT_POLL_TIMER);
    CHAT_POLL_TIMER = null;
  }
}

// ===== JOB APPLICATIONS =====

window.openAppModal = async () => {
  const modal = document.getElementById("appModal");
  const list = document.getElementById("appList");
  if (modal) modal.style.display = "flex";
  if (list) list.innerHTML = '<div style="text-align:center; padding:20px; opacity:0.6;">Cargando...</div>';

  try {
    const [resApps, resPhotos] = await Promise.all([
      apiFetch("/api/boss/employee-requests?status=pending"),
      apiFetch("/api/boss/photo-change-requests?status=pending")
    ]);

    const apps = Array.isArray(resApps) ? resApps : (resApps.data || []);
    const photoReqs = Array.isArray(resPhotos) ? resPhotos : (resPhotos.data || []);

    const appsHtml = apps.length === 0
      ? '<div style="text-align:center; padding:16px; opacity:0.6;">No hay solicitudes de empleo pendientes.</div>'
      : apps.map(app => `
         <div style="background:rgba(255,255,255,0.05); padding:14px; border-radius:12px; margin-bottom:10px; border:1px solid rgba(255,255,255,0.1);">
           <div style="display:flex; gap:14px; align-items:flex-start;">
              <div style="flex-shrink:0;">
                  <img src="${app.photoUrl || 'assets/img/logo_placeholder.png'}" 
                       alt="Selfie" 
                       style="width:80px; height:80px; object-fit:cover; border-radius:12px; border:2px solid #22c55e; cursor:pointer;"
                       data-boss-action="open-image"
                       data-open-url="${escapeHtml(app.photoUrl || "")}"
                       title="Ver Foto Original"
                  >
              </div>
              <div style="flex:1;">
                 <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                      <div>
                          <div style="font-weight:bold; font-size:1.1rem; color:#fff;">${escapeHtml(app.displayName || app.name || app.email || 'Sin nombre')}</div>
                          <div style="opacity:0.8; margin-top:4px;">${escapeHtml(app.email || 'Sin Email')}</div>
                          <div style="color:#4ade80; font-weight:bold; margin-top:4px;">Tel: ${escapeHtml(app.phone || 'Sin Celular')}</div>
                          <div style="font-size:0.8rem; opacity:0.5; margin-top:4px;">UID: ${app.uid}</div>
                      </div>
                      <div style="font-size:0.8rem; background:rgba(255,255,255,0.1); padding:4px 8px; border-radius:6px;">${new Date(app.createdAt).toLocaleDateString()}</div>
                 </div>
              </div>
           </div>
           <div style="margin-top:16px; display:flex; gap:10px;">
              <button type="button" class="btn btn-green" data-boss-action="approve-app" data-application-id="${encodeURIComponent(app.id || "")}" style="flex:1;">Contratar</button>
              <button type="button" class="btn btn-danger" data-boss-action="reject-app" data-application-id="${encodeURIComponent(app.id || "")}" style="flex:1;">Rechazar</button>
           </div>
         </div>
       `).join('');

    const photoHtml = photoReqs.length === 0
      ? '<div style="text-align:center; padding:16px; opacity:0.6;">No hay solicitudes de cambio de foto.</div>'
      : photoReqs.map(req => `
         <div style="background:rgba(59,130,246,0.08); padding:14px; border-radius:12px; margin-bottom:10px; border:1px solid rgba(59,130,246,0.2);">
           <div style="display:flex; gap:14px; align-items:flex-start;">
              <div style="flex-shrink:0;">
                  <img src="${req.currentPhotoUrl || 'assets/img/logo_placeholder.png'}" 
                       alt="Selfie" 
                       style="width:80px; height:80px; object-fit:cover; border-radius:12px; border:2px solid #60a5fa; cursor:pointer;"
                       data-boss-action="open-image"
                       data-open-url="${escapeHtml(req.currentPhotoUrl || "")}"
                       title="Foto actual"
                  >
              </div>
              <div style="flex:1;">
                 <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                      <div>
                          <div style="font-weight:bold; font-size:1.05rem; color:#fff;">${escapeHtml(req.email || 'Sin Email')}</div>
                          <div style="font-size:0.85rem; opacity:0.7; margin-top:4px;">${escapeHtml(req.displayName || '')}</div>
                          <div style="font-size:0.8rem; opacity:0.5; margin-top:4px;">UID: ${req.uid}</div>
                      </div>
                      <div style="font-size:0.8rem; background:rgba(255,255,255,0.1); padding:4px 8px; border-radius:6px;">${req.requestedAt ? new Date(req.requestedAt).toLocaleDateString() : ''}</div>
                 </div>
              </div>
           </div>
           <div style="margin-top:16px; display:flex; gap:10px;">
              <button type="button" class="btn btn-green" data-boss-action="approve-photo-change" data-photo-change-id="${encodeURIComponent(req.id || "")}" style="flex:1;">Aprobar cambio</button>
              <button type="button" class="btn btn-danger" data-boss-action="reject-photo-change" data-photo-change-id="${encodeURIComponent(req.id || "")}" style="flex:1;">Rechazar</button>
           </div>
         </div>
       `).join('');

    list.innerHTML = `
      <div style="font-weight:900; margin-bottom:10px; color:#22c55e;">Solicitudes de Empleo</div>
      ${appsHtml}
      <div style="font-weight:900; margin:18px 0 10px; color:#60a5fa;">Solicitudes de Cambio de Foto</div>
      ${photoHtml}
    `;

  } catch (e) {
    if (list) list.innerHTML = `<div style="color:#ef4444; padding:20px;">Error: ${e.message}</div>`;
  }
};

window.approveApp = async (id) => {
  if (!confirm("¿Aprobar solicitud? El usuario recibirá permisos de EMPLEADO inmediatamente.")) return;
  try {
    await apiFetch(`/api/boss/employee-requests/${id}/approve`, { method: "POST" });
    alert("✅ Empleado aprobado exitosamente.");
    openAppModal();
  } catch (e) { alert("Error: " + e.message); }
};

window.rejectApp = async (id) => {
  if (!confirm("¿Rechazar solicitud?")) return;
  try {
    await apiFetch(`/api/boss/employee-requests/${id}/reject`, { method: "POST" });
    openAppModal();
  } catch (e) { alert("Error: " + e.message); }
};

window.approvePhotoChange = async (id) => {
  if (!confirm("Aprobar cambio de foto?")) return;
  try {
    await apiFetch(`/api/boss/photo-change-requests/${id}/approve`, { method: "POST" });
    openAppModal();
  } catch (e) { alert("Error: " + e.message); }
};

window.rejectPhotoChange = async (id) => {
  if (!confirm("Rechazar cambio de foto?")) return;
  try {
    await apiFetch(`/api/boss/photo-change-requests/${id}/reject`, { method: "POST" });
    openAppModal();
  } catch (e) { alert("Error: " + e.message); }
};

// ===== INIT =====
highlightFilter();

onAuthStateChanged(auth, (user) => {
  (async () => {
  if (!user) {
    await clearPortalSession({ revoke: true });
    stopEmergencyPolling();
    window.location.href = "login-jefe.html";
    return;
  }
  if (!(await isBossUser(user))) {
    await clearPortalSession({ revoke: true });
    stopEmergencyPolling();
    alert("Este usuario no es Jefe.");
    window.location.href = "panel-empleado.html";
    return;
  }
  await syncPortalSessionFromUser(user, "boss");
  initBossNotifier();
  CURRENT_USER = user;
  bossPill.textContent = `Boss: ${user.email || user.uid}`;
  bindAuditEvents();
  bindBrandConfigEvents();
  bindNotificationSettingsEvents();
  bindCollapsibleSections();
  bindDashboardFilterEvents();
  await loadBrandConfig(true);
  await loadNotificationSettings();
  startAuditRealtime(true);
  startRealtime(false);
  await Promise.all([
    fetchEmergencyCalls({ silent: false }),
    fetchReviewQueue({ silent: false }),
  ]);
  startEmergencyPolling();
  loadEarnings(); // Load earnings on init
  })().catch((error) => {
    console.error("Boss panel init error:", error);
    clearPortalSession({ revoke: true });
    stopEmergencyPolling();
    alert("No se pudo inicializar el panel de jefe.");
    window.location.href = "login-jefe.html";
  });
});
