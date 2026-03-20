/**
 * Elite Employee Requests Panel
 * Master-Detail Architecture for High-Volume Scaling
 */

import { apiFetch, uploadImage } from "./api.js?v=20260310b";
import { requireAuth, getSavedName } from "./session.js";
import {
  listAvailableRequests,
  listMyRequests,
  claimRequest,
  releaseClaim,
  sendProposal,
  markFinished,
  submitPaymentProof,
  notifyBossPaymentReview,
  STATUS,
} from "./marketplace-api.js";

/* =========================
   STATE & CONSTANTS
========================= */
let FILTER = "available";
let REQUESTS = [];
let SELECTED_ID = null;
let CURRENT_USER = null;
let REFRESH_TIMER = null;
const REFRESH_MS = 6000;
let AUTO_FOCUS_ID = null;
let AUTO_FOCUS_STATUS = null;
let AUTO_FOCUS_RUNNING = false;
let AUTO_SYNC_RUNNING = false;
let PAYMENT_TYPE_FILTER = "all";
let CLIENT_ACTIONS_BOUND = false;

function decodeDataValue(value) {
  try {
    return decodeURIComponent(String(value || ""));
  } catch (_) {
    return String(value || "");
  }
}

function navigateTo(url) {
  window.location.href = url;
}

async function handleClientUiAction(action, element) {
  switch (String(action || "").trim()) {
    case "go-back":
      window.goBack?.();
      return;
    case "set-filter":
      window.setFilter?.(element?.getAttribute("data-filter") || "available");
      return;
    case "close-detail":
      window.closeDetail?.();
      return;
    default:
      return;
  }
}

async function handleClientAction(action, element) {
  const requestId = decodeDataValue(element?.getAttribute("data-request-id"));

  switch (String(action || "").trim()) {
    case "select-request":
      window.selectRequest?.(requestId);
      return;
    case "set-payment-filter":
      window.setPaymentTypeFilter?.(element?.getAttribute("data-payment-filter") || "all");
      return;
    case "claim":
      await window.handleClaim?.(requestId);
      return;
    case "open-chat":
      await window.openChat?.(requestId, element?.getAttribute("data-chat-internal") === "1");
      return;
    case "prepare-estimate":
      navigateTo(`estimate-form.html?requestId=${encodeURIComponent(requestId)}`);
      return;
    case "release":
      await window.handleRelease?.(requestId);
      return;
    case "finish":
      await window.handleFinish?.(requestId);
      return;
    case "open-payment-upload": {
      const uploadInputId = element?.getAttribute("data-upload-input-id");
      const uploadInput = uploadInputId ? document.getElementById(uploadInputId) : null;
      uploadInput?.click();
      return;
    }
    case "notify-boss-payment":
      await window.handleNotifyBossPayment?.(requestId);
      return;
    default:
      return;
  }
}

function bindClientDelegatedActions() {
  if (CLIENT_ACTIONS_BOUND) return;
  CLIENT_ACTIONS_BOUND = true;

  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;

    const uiElement = event.target.closest("[data-client-ui-action]");
    if (uiElement) {
      event.preventDefault();
      void handleClientUiAction(uiElement.getAttribute("data-client-ui-action"), uiElement);
      return;
    }

    const actionElement = event.target.closest("[data-client-action]");
    if (!actionElement) return;

    event.preventDefault();
    void handleClientAction(actionElement.getAttribute("data-client-action"), actionElement);
  });

  document.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.getAttribute("data-client-action") !== "payment-upload-input") return;

    const requestId = decodeDataValue(target.getAttribute("data-request-id"));
    void window.handlePaymentUpload?.(requestId, target);
  });

  document.addEventListener("keydown", (event) => {
    if (!(event.target instanceof Element)) return;
    if (event.key !== "Enter" && event.key !== " ") return;

    const interactive = event.target.closest("[data-client-ui-action], [data-client-action]");
    if (!interactive) return;
    if (interactive.tagName === "BUTTON" || interactive.tagName === "A" || interactive.tagName === "INPUT") return;

    event.preventDefault();
    if (interactive.hasAttribute("data-client-ui-action")) {
      void handleClientUiAction(interactive.getAttribute("data-client-ui-action"), interactive);
      return;
    }
    void handleClientAction(interactive.getAttribute("data-client-action"), interactive);
  });
}

document.addEventListener("DOMContentLoaded", init);

async function init() {
  try {
    bindClientDelegatedActions();
    CURRENT_USER = await requireAuth("employee");

    // Check for deep link
    const params = new URLSearchParams(window.location.search);
    const selectId = params.get("select");

    if (selectId) {
      // If we have a specific ID, let's try to find it. 
      // We start by fetching ALL potentially relevant requests to ensure we find it.
      FILTER = "mine"; // Default to 'mine' as most deeper interactions happen there
      highlightFilter();
      setAutoFocus(selectId);
      await loadRequests(true);
    } else {
      highlightFilter();
      await loadRequests(true);
    }

    startAutoRefresh();
  } catch (e) {
    console.error("Auth error:", e);
  }
}

/* =========================
   CORE LOGIC
========================= */
window.setFilter = (f) => {
  FILTER = f;
  SELECTED_ID = null; // Reset selection on filter change
  highlightFilter();
  loadRequests(true);
};

window.setPaymentTypeFilter = (type) => {
  PAYMENT_TYPE_FILTER = type;
  renderList();
};

window.goBack = () => { window.location.href = "panel-empleado.html"; };
window.reloadList = () => { loadRequests(true); };

function highlightFilter() {
  document.querySelectorAll(".tab-btn").forEach(b => {
    b.classList.toggle("active", b.getAttribute("data-filter") === FILTER);
  });
}

function filterForStatus(status) {
  if (status === STATUS.EN_ESPERA) return "available";
  if ([STATUS.ASIGNADO, STATUS.NEGOCIANDO, STATUS.EN_PROCESO, STATUS.ESPERANDO_CIERRE_CLIENTE].includes(status)) return "mine";
  if ([STATUS.CANCELADO, STATUS.COMPLETADO].includes(status)) return "done";
  if ([STATUS.ESPERANDO_COMPROBANTE_PAGO, STATUS.PAGO_PENDIENTE_REVISION].includes(status)) return "payments";
  return "mine";
}

function setAutoFocus(id, status) {
  AUTO_FOCUS_ID = id;
  AUTO_FOCUS_STATUS = status || null;
}

async function ensureAutoFocus() {
  if (AUTO_FOCUS_RUNNING || !AUTO_FOCUS_ID) return;
  AUTO_FOCUS_RUNNING = true;
  try {
    const req = REQUESTS.find(r => r.id === AUTO_FOCUS_ID);
    const status = AUTO_FOCUS_STATUS || req?.status;
    const target = status ? filterForStatus(status) : null;
    if (target && FILTER !== target) {
      FILTER = target;
      highlightFilter();
      await loadRequests(true);
      return;
    }
    if (req) {
      selectRequest(AUTO_FOCUS_ID);
    }
    AUTO_FOCUS_ID = null;
    AUTO_FOCUS_STATUS = null;
  } finally {
    AUTO_FOCUS_RUNNING = false;
  }
}

async function ensureSelectedVisible() {
  if (AUTO_FOCUS_RUNNING || AUTO_SYNC_RUNNING || AUTO_FOCUS_ID) return;
  if (!SELECTED_ID) return;
  const req = REQUESTS.find(r => r.id === SELECTED_ID);
  if (!req) return;
  const target = filterForStatus(req.status);
  if (target && FILTER !== target) {
    AUTO_SYNC_RUNNING = true;
    FILTER = target;
    highlightFilter();
    await loadRequests(true);
    AUTO_SYNC_RUNNING = false;
  }
}

async function loadRequests(force = false) {
  try {
    const liveGuard = window.__SWE_LIVE_INPUT_GUARD__;
    if (liveGuard) liveGuard.captureCurrent();
    let resAvail = { data: [] };
    let resMine = { data: [] };

    // Optimize: only fetch what's needed based on filter, 
    // but usually we need 'Available' or 'Mine' context.
    if (FILTER === "available") {
      resAvail = await listAvailableRequests({ limit: 100 });
    } else {
      resMine = await listMyRequests({ limit: 100 });
    }

    const avail = Array.isArray(resAvail.data) ? resAvail.data : [];
    const mine = Array.isArray(resMine.data) ? resMine.data : [];

    // Merge and Dedupe
    const map = new Map();
    [...avail, ...mine].forEach(r => map.set(r.id, r));

    // Sort by Date Desc
    REQUESTS = Array.from(map.values()).sort((a, b) =>
      new Date(b.createdAt) - new Date(a.createdAt)
    );

    renderList();
    await ensureSelectedVisible();
    await ensureAutoFocus();
    if (liveGuard) liveGuard.scheduleRestore();
  } catch (e) {
    console.error("Load error:", e);
  }
}

/* =========================
   RENDERING (MASTER)
========================= */
function renderList() {
  const container = document.getElementById("list");

  // Filtering Logic for Tabs
  const filtered = REQUESTS.filter(r => {
    if (FILTER === "available") return r.status === STATUS.EN_ESPERA && !r.assignedEmployeeId;

    const isMine = r.assignedEmployeeId === CURRENT_USER.uid;
    if (FILTER === "mine") {
      return isMine && [
        STATUS.ASIGNADO,
        STATUS.NEGOCIANDO,
        STATUS.EN_PROCESO,
        STATUS.ESPERANDO_CIERRE_CLIENTE
      ].includes(r.status);
    }
    if (FILTER === "done") return isMine && r.status === STATUS.COMPLETADO;
    if (FILTER === "payments") return isMine && [
      STATUS.ESPERANDO_COMPROBANTE_PAGO,
      STATUS.PAGO_PENDIENTE_REVISION,
      STATUS.COMPLETADO
    ].includes(r.status);

    return false;
  });

  if (filtered.length === 0) {
    if (FILTER === "payments") {
      container.innerHTML = `${renderPaymentsSummary([])}<div style="padding:24px; text-align:center; opacity:0.5;">Sin pagos todavía.</div>`;
    } else {
      container.innerHTML = `<div style="padding:40px; text-align:center; opacity:0.5;">Sin solicitudes aquí.</div>`;
    }
    return;
  }

  const cardsHtml = filtered.map(r => `
    <div class="mini-card ${SELECTED_ID === r.id ? 'active' : ''}" role="button" tabindex="0" data-client-action="select-request" data-request-id="${encodeURIComponent(r.id || "")}">
      ${r.urgencia === 'alta' ? '<span class="urgency-tag text-red">● Urgente</span>' : ''}
      <h3>${escapeHtml(r.clientNickname || 'Servicio')}</h3>
      <div class="meta-row">
        <span>${r.category || 'General'}</span>
        <span>•</span>
        <span>${fmtTimeAgo(r.createdAt)}</span>
      </div>
      ${FILTER === "payments" ? renderPaymentMini(r) : ''}
      <div class="meta-row" style="margin-top:4px; font-weight:700; color:var(--text-main);">
        ${statusLabel(r.status)}
      </div>
    </div>
  `).join("");

  const summaryHtml = FILTER === "payments" ? renderPaymentsSummary(filtered) : "";
  container.innerHTML = summaryHtml + cardsHtml;
}

function renderPaymentMini(req) {
  const metrics = getPaymentMetrics(req, PAYMENT_TYPE_FILTER);
  const hasRejection =
    req?.status === STATUS.ESPERANDO_COMPROBANTE_PAGO &&
    Boolean(req?.paymentRejectedAt || req?.paymentRejectedAtMs);
  return `
    <div class="pay-mini">
      Pagado ${money(metrics.paid)} • Ganancia ${money(metrics.earned)} • Material ${money(metrics.material)}
      ${hasRejection ? '<br><span style="color:#fca5a5; font-weight:700;">Comprobante rechazado: reenvío pendiente</span>' : ''}
    </div>
  `;
}

function renderPaymentsSummary(list = []) {
  const totals = calculatePaymentsTotals(list, PAYMENT_TYPE_FILTER);
  const filterButtons = [
    { key: "all", label: "Todo" },
    { key: "servicio", label: "Servicio" },
    { key: "material", label: "Material" },
  ].map(f => `
    <button type="button" class="pay-filter-btn ${PAYMENT_TYPE_FILTER === f.key ? 'active' : ''}" data-client-action="set-payment-filter" data-payment-filter="${f.key}">${f.label}</button>
  `).join("");

  const cards = [
    { key: "day", label: "Dia" },
    { key: "week", label: "Semana" },
    { key: "month", label: "Mes" },
    { key: "year", label: "Anio" },
    { key: "all", label: "Total" },
  ].map(p => {
    const t = totals[p.key];
    return `
      <div class="pay-card">
        <div class="pay-title">${p.label}</div>
        <div class="pay-row"><span>Pagado</span><strong>${money(t.paid)}</strong></div>
        <div class="pay-row"><span>Ganancia</span><strong>${money(t.earned)}</strong></div>
        <div class="pay-row"><span>Material</span><strong>${money(t.material)}</strong></div>
      </div>
    `;
  }).join("");

  return `
    <div class="payments-summary">
      <div class="payments-summary-head">
        <div class="payments-title">Resumen de pagos</div>
        <div class="payments-filters">${filterButtons}</div>
      </div>
      <div class="payments-grid">
        ${cards}
      </div>
    </div>
  `;
}

/* =========================
   RENDERING (DETAIL)
========================= */
window.selectRequest = (id) => {
  SELECTED_ID = id;
  renderList();
  renderDetail();
  // On mobile, open detail overlay
  if (window.innerWidth <= 900) {
    const detailPanel = document.getElementById("detailPanel");
    if (detailPanel) {
      detailPanel.classList.add("visible");
      detailPanel.scrollIntoView({ behavior: "smooth" });
    }
  }
};

window.closeDetail = () => {
  SELECTED_ID = null;
  const detailPanel = document.getElementById("detailPanel");
  if (detailPanel) detailPanel.classList.remove("visible");
  renderList();
  renderDetail();
};

function renderDetail() {
  const empty = document.getElementById("detailEmpty");
  const view = document.getElementById("detailView");
  const panel = document.getElementById("detailPanel");
  const req = REQUESTS.find(r => r.id === SELECTED_ID);

  if (!req) {
    empty.style.display = "flex";
    view.style.display = "none";
    if (panel && window.innerWidth <= 900) panel.classList.remove("visible");
    return;
  }

  empty.style.display = "none";
  view.style.display = "block";

  const isMine = req.assignedEmployeeId === CURRENT_USER.uid;
  const statusStep = getStatusStep(req.status);

  view.innerHTML = `
    <div class="detail-header-pro">
      <div>
        <div style="font-size:0.8rem; color:var(--text-dim); margin-bottom:4px;">ID: ${req.id}</div>
        <h2 style="margin:0; font-size:1.8rem; font-weight:900;">${escapeHtml(req.clientNickname || 'Cliente')}</h2>
      </div>
      <div class="badge" style="background:${statusColor(req.status)}22; color:${statusColor(req.status)}; padding:10px 20px; border-radius:12px; font-weight:800;">
        ${statusLabel(req.status).toUpperCase()}
      </div>
    </div>

    <!-- State Tracker PIPs -->
    <div class="status-tracker-pro">
      <div class="step-pip ${statusStep >= 1 ? 'filled' : ''}"></div>
      <div class="step-pip ${statusStep >= 2 ? 'filled' : ''}"></div>
      <div class="step-pip ${statusStep >= 3 ? 'filled' : ''}"></div>
      <div class="step-pip ${statusStep >= 4 ? 'filled' : ''}"></div>
    </div>

    <div class="detail-grid">
      <div class="action-hero" style="margin-top:0;">
        <div style="color:var(--text-dim); font-size:0.75rem; margin-bottom:8px;">DESCRIPCIÓN DEL PROBLEMA</div>
        <div style="font-size:1rem; line-height:1.5;">${escapeHtml(req.description || "Sin descripción")}</div>
      </div>
      <div class="action-hero" style="margin-top:0;">
        <div style="color:var(--text-dim); font-size:0.75rem; margin-bottom:8px;">UBICACIÓN</div>
        <div style="font-size:1.1rem; font-weight:700;">📍 ${escapeHtml(req.address || "—")}</div>
      </div>
    </div>

    ${req.photoUrl ? `
      <div style="margin-bottom:30px;">
        <img src="${req.photoUrl}" style="width:100%; border-radius:24px; border:1px solid var(--glass-border); max-height:400px; object-fit:cover;" />
      </div>
    ` : ''}

    <!-- ACTIONS SECTION -->
    <div class="action-hero">
      ${renderStateActions(req)}
    </div>
  `;
}

function renderStateActions(req) {
  const status = req.status;
  const isMine = req.assignedEmployeeId === CURRENT_USER.uid;

  if (status === STATUS.EN_ESPERA && !req.assignedEmployeeId) {
    return `
      <div style="text-align:center;">
        <p style="opacity:0.7; margin-bottom:20px;">Esta solicitud está disponible. Reclámala ahora para empezar a trabajar.</p>
        <button type="button" class="btn-hero" style="background:var(--accent-primary); color:#000;" data-client-action="claim" data-request-id="${encodeURIComponent(req.id || "")}">RECLAMAR CASO</button>
      </div>
    `;
  }

  if (isMine) {
    const chatBtn = `<button type="button" class="btn-hero" style="background:rgba(255,255,255,0.1); color:#fff; margin-bottom:12px;" data-client-action="open-chat" data-request-id="${encodeURIComponent(req.id || "")}" data-chat-internal="0">ABRIR CHAT CON CLIENTE</button>`;

    if (status === STATUS.ASIGNADO) {
      return `
        ${chatBtn}
        <button type="button" class="btn-hero" style="background:var(--accent-secondary); color:#fff;" data-client-action="prepare-estimate" data-request-id="${encodeURIComponent(req.id || "")}">PREPARAR PRESUPUESTO</button>
        <button type="button" class="btn-hero" style="background:transparent; color:var(--accent-danger); border:1px solid var(--accent-danger); margin-top:20px; scale:0.8;" data-client-action="release" data-request-id="${encodeURIComponent(req.id || "")}">ABANDONAR CASO</button>
      `;
    }

    if (status === STATUS.NEGOCIANDO) {
      return `
        ${chatBtn}
        <div style="padding:20px; border-radius:12px; background:rgba(0,0,0,0.2); text-align:center;">
          <b>Presupuesto enviado: $${req.proposal?.amount}</b>
          <p style="font-size:0.8rem; opacity:0.6; margin-top:10px;">Esperando que el cliente lo acepte para empezar la obra.</p>
        </div>
      `;
    }

    if (status === STATUS.EN_PROCESO) {
      return `
        ${chatBtn}
        <p style="text-align:center; opacity:0.8; margin-bottom:15px;">Estás trabajando en este caso.</p>
        <button type="button" class="btn-hero" style="background:var(--accent-primary); color:#000;" data-client-action="finish" data-request-id="${encodeURIComponent(req.id || "")}">MARCAR OBRA TERMINADA</button>
      `;
    }

    if (status === STATUS.ESPERANDO_CIERRE_CLIENTE) {
      return `
        <button type="button" class="btn-hero" style="background:rgba(255,255,255,0.1); color:#fff; border:1px solid rgba(255,255,255,0.2);" data-client-action="open-chat" data-request-id="${encodeURIComponent(req.id || "")}" data-chat-internal="1">💬 SOPORTE / CHAT CON JEFE</button>
        <div style="padding:20px; border-radius:12px; background:rgba(0,0,0,0.2); text-align:center; margin-top:15px;">
          <p style="font-size:0.9rem; margin:0;">Obra terminada. Esperando que el cliente confirme el cierre.</p>
        </div>
      `;
    }

    if (status === STATUS.ESPERANDO_COMPROBANTE_PAGO) {
      const amount = Number(req.finalAmount || 0);
      const comm = Math.round(amount * 0.20 * 100) / 100;
      const breakdown = getBreakdown(req);
      const rejectionReason = String(req.paymentRejectionReason || "").trim();
      const rejectedAt = req.paymentRejectedAt || req.paymentRejectedAtMs || null;
      const rejectedBy = String(req.paymentRejectedBy || "").trim();
      const rejectionCard = rejectedAt
        ? `
        <div style="background:rgba(239,68,68,0.14); border:1px solid rgba(239,68,68,0.42); padding:14px; border-radius:12px; margin-bottom:14px;">
          <div style="font-weight:800; color:#fca5a5; margin-bottom:6px;">⚠️ Comprobante rechazado por el jefe</div>
          <div style="font-size:0.9rem; line-height:1.5;">
            <div><b>Motivo:</b> ${escapeHtml(rejectionReason || "No se indicó motivo.")}</div>
            <div style="opacity:0.85; margin-top:4px;">
              <b>Fecha:</b> ${fmtDate(rejectedAt)}${rejectedBy ? ` • <b>Revisó:</b> ${escapeHtml(rejectedBy)}` : ""}
            </div>
          </div>
        </div>
      `
        : "";
      return `
        ${rejectionCard}
        <div style="background:rgba(255,158,11,0.1); border:1px solid var(--accent-warning); padding:20px; border-radius:16px;">
          <h3 style="margin:0 0 10px 0; color:var(--accent-warning);">PAGO CONFIRMADO POR CLIENTE</h3>
          <div style="display:flex; justify-content:space-between; font-size:1.2rem; font-weight:800; margin-bottom:10px;">
            <span>TOTAL TRABAJO:</span>
            <span>$${amount.toLocaleString()}</span>
          </div>
          <div style="display:grid; gap:6px; font-size:0.9rem; opacity:0.9;">
            <div style="display:flex; justify-content:space-between;">
              <span>Servicios:</span>
              <span>$${breakdown.service.toLocaleString()}</span>
            </div>
            <div style="display:flex; justify-content:space-between;">
              <span>Materiales:</span>
              <span>$${breakdown.material.toLocaleString()}</span>
            </div>
          </div>
          <div style="display:flex; justify-content:space-between; color:var(--accent-primary); font-size:1rem; border-top:1px solid rgba(255,255,255,0.1); padding-top:10px;">
            <span>A DEPOSITAR AL JEFE (20%):</span>
            <span>$${comm.toLocaleString()}</span>
          </div>
        </div>
        <div style="margin-top:16px; padding:14px; border-radius:12px; background:rgba(59,130,246,0.12); border:1px solid rgba(96,165,250,0.35); font-size:0.92rem; line-height:1.5;">
          Al subir el comprobante, el sistema notifica al jefe al numero WhatsApp configurado en su panel.
        </div>
        <button type="button" class="btn-hero" style="background:var(--accent-warning); color:#000; margin-top:20px;" data-client-action="open-payment-upload" data-request-id="${encodeURIComponent(req.id || "")}" data-upload-input-id="paymentUploadInput">${rejectedAt ? "REENVIAR COMPROBANTE Y NOTIFICAR AL JEFE" : "SUBIR COMPROBANTE Y NOTIFICAR AL JEFE"}</button>
        <input type="file" id="paymentUploadInput" style="display:none;" data-client-action="payment-upload-input" data-request-id="${encodeURIComponent(req.id || "")}" />
      `;
    }

    if (status === STATUS.PAGO_PENDIENTE_REVISION) {
      const amount = Number(req.finalAmount || 0);
      const comm = Math.round(amount * 0.20 * 100) / 100;
      return `
        <div style="text-align:center; opacity:0.8;">⌛ Comprobante enviado. Esperando que el jefe apruebe.</div>
        <div style="margin-top:10px; padding:12px; border-radius:10px; background:rgba(255,255,255,0.06);">
          Monto pagado por cliente: <b>${money(amount)}</b><br />
          Depósito reportado al jefe (20%): <b>${money(comm)}</b>
        </div>
        <div style="margin-top:12px; padding:12px; border-radius:10px; background:rgba(59,130,246,0.12); border:1px solid rgba(96,165,250,0.35); font-size:0.9rem; line-height:1.5;">
          Si el jefe no vio el aviso todavía, puedes reenviar la notificación al mismo numero que él configuró.
        </div>
        <button type="button" class="btn-hero" style="background:rgba(59,130,246,0.95); color:#fff; margin-top:16px;" data-client-action="notify-boss-payment" data-request-id="${encodeURIComponent(req.id || "")}">VOLVER A NOTIFICAR AL JEFE</button>
      `;
    }
  }

  return `<div style="text-align:center; opacity:0.4;">No hay acciones disponibles.</div>`;
}

/* =========================
   UTILITIES
 ========================= */
function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function money(n) {
  const v = toNumber(n);
  return "$" + v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getBreakdown(req) {
  const proposal = req?.proposal || {};
  const breakdown = proposal.breakdown || {};
  if ((!breakdown.serviceTotal && !breakdown.materialTotal) && Array.isArray(proposal.items)) {
    let s = 0;
    let m = 0;
    proposal.items.forEach(it => {
      const type = (it.type || "").toLowerCase();
      const amount = toNumber(it.amount) || (toNumber(it.qty) * toNumber(it.price));
      if (type === "material") m += amount;
      else s += amount;
    });
    breakdown.serviceTotal = s;
    breakdown.materialTotal = m;
    breakdown.total = s + m;
  }
  const paid = toNumber(req.finalAmount) || toNumber(breakdown.total) || toNumber(proposal.amount);
  let service = toNumber(breakdown.serviceTotal);
  let material = toNumber(breakdown.materialTotal);

  if (service === 0 && material === 0) {
    service = paid;
  }

  // If total differs, scale service/material to match paid
  const totalRef = toNumber(breakdown.total) || (service + material);
  if (paid > 0 && totalRef > 0 && Math.abs(totalRef - paid) > 0.01) {
    const ratio = paid / totalRef;
    service = service * ratio;
    material = material * ratio;
  }

  return { paid, service, material };
}

function getPaymentMetrics(req, typeFilter) {
  const b = getBreakdown(req);
  if (typeFilter === "servicio") {
    return { paid: b.service, earned: b.service, material: 0 };
  }
  if (typeFilter === "material") {
    return { paid: b.material, earned: 0, material: b.material };
  }
  return { paid: b.paid, earned: b.service, material: b.material };
}

function getPaymentDate(req) {
  const raw = req.bossApprovedAt || req.clientClosedAt || req.updatedAt || req.createdAt;
  const d = raw ? new Date(raw) : null;
  return d && !isNaN(d.getTime()) ? d : null;
}

function calculatePaymentsTotals(list = [], typeFilter = "all") {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = now.getDay();
  const diff = (day + 6) % 7; // Monday as start
  const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  const totals = {
    day: { paid: 0, earned: 0, material: 0 },
    week: { paid: 0, earned: 0, material: 0 },
    month: { paid: 0, earned: 0, material: 0 },
    year: { paid: 0, earned: 0, material: 0 },
    all: { paid: 0, earned: 0, material: 0 }
  };

  list.forEach(req => {
    const d = getPaymentDate(req);
    if (!d) return;
    const m = getPaymentMetrics(req, typeFilter);
    totals.all.paid += m.paid;
    totals.all.earned += m.earned;
    totals.all.material += m.material;
    if (d >= startOfDay) {
      totals.day.paid += m.paid;
      totals.day.earned += m.earned;
      totals.day.material += m.material;
    }
    if (d >= startOfWeek) {
      totals.week.paid += m.paid;
      totals.week.earned += m.earned;
      totals.week.material += m.material;
    }
    if (d >= startOfMonth) {
      totals.month.paid += m.paid;
      totals.month.earned += m.earned;
      totals.month.material += m.material;
    }
    if (d >= startOfYear) {
      totals.year.paid += m.paid;
      totals.year.earned += m.earned;
      totals.year.material += m.material;
    }
  });

  return totals;
}

function getStatusStep(s) {
  if (s === STATUS.EN_ESPERA) return 0;
  if ([STATUS.ASIGNADO, STATUS.NEGOCIANDO].includes(s)) return 1;
  if (s === STATUS.EN_PROCESO) return 2;
  if ([STATUS.ESPERANDO_CIERRE_CLIENTE, STATUS.ESPERANDO_COMPROBANTE_PAGO].includes(s)) return 3;
  if (s === STATUS.PAGO_PENDIENTE_REVISION) return 3.5;
  if (s === STATUS.COMPLETADO) return 4;
  return 0;
}

function statusLabel(s) {
  const lbls = {
    [STATUS.EN_ESPERA]: 'Nuevo / Disponible',
    [STATUS.ASIGNADO]: 'Tomado / Pendiente Presupuesto',
    [STATUS.NEGOCIANDO]: 'Propuesta enviada',
    [STATUS.EN_PROCESO]: 'En obra',
    [STATUS.ESPERANDO_CIERRE_CLIENTE]: 'Obra terminada / Pend. Cierre',
    [STATUS.ESPERANDO_COMPROBANTE_PAGO]: 'Esperando tu pago',
    [STATUS.PAGO_PENDIENTE_REVISION]: 'En revisión de pago',
    [STATUS.COMPLETADO]: 'Completado'
  };
  return lbls[s] || s;
}

function statusColor(s) {
  if (s === STATUS.EN_ESPERA) return '#22c55e';
  if (s === STATUS.EN_PROCESO) return '#a855f7';
  if (s === STATUS.ESPERANDO_COMPROBANTE_PAGO) return '#f59e0b';
  if (s === STATUS.COMPLETADO) return '#10b981';
  return '#6366f1';
}

function fmtDate(ts) {
  try {
    if (!ts) return "—";
    if (typeof ts === "string" || typeof ts === "number") {
      const d = new Date(ts);
      return isNaN(d.getTime()) ? "—" : d.toLocaleString();
    }
    if (ts.toDate) return ts.toDate().toLocaleString();
    return "—";
  } catch {
    return "—";
  }
}

function fmtTimeAgo(ts) {
  if (!ts) return "Reciente";
  const d = new Date(ts);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "Ahora";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  return `${Math.floor(diff / 3600)}h`;
}

function escapeHtml(s = "") {
  return String(s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}

/* =========================
   HANDLERS
========================= */
window.handleClaim = async (id) => {
  try {
    await claimRequest(id);
    setAutoFocus(id, STATUS.ASIGNADO);
    await loadRequests(true);
  } catch (e) {
    console.error("Claim error:", e);
    // 409 means it was taken by someone else or status changed
    if (e.status === 409) {
      alert("⚠️ Esta solicitud ya no está disponible (fue tomada por otro o cancelada).");
    } else {
      alert("Error al reclamar: " + (e.message || "Desconocido"));
    }
    // Reload to reflect reality
    await loadRequests(true);
  }
};

window.handleRelease = async (id) => {
  if (!confirm("¿Abandonar este caso?")) return;
  try {
    await releaseClaim(id);
    await loadRequests(true);
  } catch (e) { alert(e.message); }
};

window.handleFinish = async (id) => {
  if (!confirm("¿Confirmas que terminaste el trabajo?")) return;
  try {
    // Optimistic / Loading feedback
    // Ideally we disable the button, but since we re-render, a simple alert/loading is mostly ok.
    // Better: 
    const btn = document.querySelector(`button[data-client-action="finish"][data-request-id="${encodeURIComponent(id)}"]`);
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Procesando...";
    }

    await markFinished(id);
    setAutoFocus(id, STATUS.ESPERANDO_CIERRE_CLIENTE);
    await loadRequests(true);
  } catch (e) {
    console.error("Finish error:", e);
    // If double-clicked or race condition, we might get invalid transition.
    // Reloading usually fixes the UI to show the new state.
    if (e.message && e.message.includes("transition")) {
      // Silent recovery or mild notice
      console.warn("Transition error (race condition?), reloading.");
    } else {
      alert(e.message);
    }
    await loadRequests(true);
  }
};

/* =========================
   CHAT UI
========================= */
let CHAT_REQUEST_ID = null;
let CHAT_IS_INTERNAL = false;
let CHAT_MESSAGES = [];
let CHAT_POLL_TIMER = null;
let CHAT_LAST_SENT = 0;
let CHAT_COOLDOWN_TIMER = null;

function ensureChatPanel() {
  const panel = document.getElementById("chatPanel");
  if (!panel) return false;

  // Check if we effectively have the elements
  if (!document.getElementById("chatTitle")) {
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
          <div id="chatClient" class="chat-profile-body">—</div>
        </div>
        <div class="chat-profile">
          <div class="chat-profile-title">Empleado</div>
          <div id="chatEmployee" class="chat-profile-body">—</div>
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

    // Attach listeners
    document.getElementById("chatClose").addEventListener("click", closeChat);
    document.getElementById("chatSend").addEventListener("click", sendChat);
    document.getElementById("chatInput").addEventListener("keydown", (e) => {
      if (e.key === "Enter") sendChat();
    });
  }
  return true;
}

window.openChat = async (requestId, isInternal = false) => {
  const req = REQUESTS.find(r => r.id === requestId);
  if (!req) return;
  if (!ensureChatPanel()) return;

  CHAT_REQUEST_ID = requestId;
  CHAT_IS_INTERNAL = isInternal;

  const headerTitle = document.getElementById("chatTitle");
  const headerMeta = document.getElementById("chatMeta");
  const panel = document.getElementById("chatPanel");

  // Customize UI based on mode
  if (CHAT_IS_INTERNAL) {
    headerTitle.textContent = `🔒 CHAT PRIVADO (JEFE)`;
    headerMeta.textContent = "Sólo visible para Empleado y Jefe. El cliente NO ve esto.";
    panel.classList.add("internal-mode");
  } else {
    headerTitle.textContent = `Chat del Trabajo 💬`;
    headerMeta.textContent = "Canal compartido: Cliente, Empleado y Jefe";
    panel.classList.remove("internal-mode");
  }

  const chatClient = document.getElementById("chatClient");
  const chatEmployee = document.getElementById("chatEmployee");

  chatClient.innerHTML = `
    <span class="chat-name">${escapeHtml(req.clientNickname || "Cliente")}</span>
    <span class="chat-email">${escapeHtml(req.clientEmail || "—")}</span>
  `;
  chatEmployee.innerHTML = `
    <span class="chat-name">${escapeHtml(req.employeeName || getSavedName("employee") || "Empleado")}</span>
    <span class="chat-email">${escapeHtml(req.employeeEmail || CURRENT_USER?.email || "")}</span>
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
  document.getElementById("chatError").textContent = "";

  document.getElementById("chatPanel").classList.remove("hidden");
  document.getElementById("chatPanel").classList.add("visible");

  try {
    await loadChatMessages();
    renderChatMessages();
    startChatPolling();
  } catch (e) {
    console.error("[chat] Load error", e);
    document.getElementById("chatError").textContent = "Error al cargar mensajes.";
  }
};

function closeChat() {
  stopChatPolling();
  CHAT_REQUEST_ID = null;
  CHAT_IS_INTERNAL = false;
  CHAT_MESSAGES = [];
  document.getElementById("chatPanel").classList.add("hidden");
  document.getElementById("chatPanel").classList.remove("visible");
  document.getElementById("chatPanel").classList.remove("internal-mode");
}

async function loadChatMessages() {
  if (!CHAT_REQUEST_ID) return;
  const res = await apiFetch(`/api/marketplace/requests/${CHAT_REQUEST_ID}/chat?limit=50`);
  CHAT_MESSAGES = res.data || [];
}

function renderChatMessages() {
  const box = document.getElementById("chatMessages");
  if (!box) return;

  if (CHAT_MESSAGES.length === 0) {
    box.innerHTML = "<div class='meta'>No hay mensajes aún.</div>";
    return;
  }

  // If in internal mode, show all? Or filter?
  // Ideally backend sends everything, we highlight internal ones.
  // But if we are in "Internal Mode", maybe we only care about internal?
  // Let's show ALL, but style internal ones differently.

  box.innerHTML = CHAT_MESSAGES.map(msg => {
    const mine = CURRENT_USER && msg.senderId === CURRENT_USER.uid;
    const isInternalMsg = msg.isInternal;

    // Filter?
    // If we are in PRIVATE mode, we want to see PRIVATE messages mostly.
    // If we are in PUBLIC mode, we might see everything? 
    // Actually, backend sends "isInternal" flag.
    // Let's mark them.

    let bubbleClass = "bubble";
    let metaPrefix = "";

    if (isInternalMsg) {
      bubbleClass += " internal-msg"; // We'll add some CSS ideally, or inline style
      metaPrefix = "🔒 PRIVADO • ";
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

// ... sendChat needs update ...
async function sendChat() {
  const input = document.getElementById("chatInput");
  const text = input.value.trim();
  if (!text) return;
  if (!CHAT_REQUEST_ID) return;

  if (Date.now() - CHAT_LAST_SENT < 2000) return; // rate limit

  // Optimistic append? Maybe too complex with internal flag logic.
  // Just wait.
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
    console.error("See chat error", e);
    alert("Error enviando mensaje: " + e.message);
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



window.handlePaymentUpload = async (id, input) => {
  const file = input.files?.[0];
  if (!file) return;
  try {
    const currentReq = REQUESTS.find((r) => r.id === id);
    const isResubmission = Boolean(currentReq?.paymentRejectedAt || currentReq?.paymentRejectedAtMs);
    const up = await uploadImage(file);
    const url = up.secure_url || up.url;
    await submitPaymentProof(id, url);
    setAutoFocus(id, STATUS.PAGO_PENDIENTE_REVISION);
    await loadRequests(true);
    alert(isResubmission
      ? "✅ Comprobante reenviado y jefe notificado. Esperando nueva aprobación."
      : "✅ Comprobante enviado y jefe notificado. Esperando aprobación.");
  } catch (e) {
    console.error("[Payment Upload Error]", e);
    alert("Error al subir comprobante: " + (e.message || "Error desconocido"));
  } finally {
    input.value = "";
  }
};

window.handleNotifyBossPayment = async (id) => {
  try {
    const res = await notifyBossPaymentReview(id);
    const notification = res?.data?.notification || {};
    const status = String(notification?.status || "").toLowerCase();
    const label = status === "sent"
      ? "WhatsApp enviado al jefe."
      : status === "queued"
        ? "Notificacion reenviada al jefe y puesta en cola."
        : "Notificacion reenviada al jefe.";
    await loadRequests(true);
    alert(`✅ ${label}`);
  } catch (e) {
    console.error("[Notify Boss Payment Error]", e);
    alert("No se pudo notificar al jefe: " + (e.message || "Error desconocido"));
  }
};

function startAutoRefresh() {
  REFRESH_TIMER = setInterval(() => loadRequests(), REFRESH_MS);
}

