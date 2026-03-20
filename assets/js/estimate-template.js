import { getApiBase } from "./runtime-config.js";
const DEFAULT_NOTES_TEXT = [
  "Estimate valid for 30 days.",
  "50% deposit required, balance due upon completion.",
  "Thank you for your business!"
].join("\n");
const NOTES_DRAFT_STORAGE_KEY = "estimate_notes_draft";
const ESTIMATE_HISTORY_STORAGE_KEY = "estimatesHistory";
const EXPORT_LAYOUT_STATE = new WeakMap();
const PAGE_WIDTH_MM = 215.9;
const PAGE_HEIGHT_MM = 279.4;
const PAGE_MARGIN_MM = 10;
const PAGE_CONTENT_RATIO = (PAGE_HEIGHT_MM - PAGE_MARGIN_MM * 2) / (PAGE_WIDTH_MM - PAGE_MARGIN_MM * 2);
const COMPANY_PROFILE = {
  displayName: "Straight Wire Electric",
  legalName: "Straight Wire Electric LLC",
  tagline: "Service Portal",
  logoUrl: "assets/images/logo.webp",
  backgroundImageUrl: "assets/images/bg-electric.webp",
  address: "3828 S Grand Ave Apt 207, Los Angeles, CA 90037",
  ein: "39-4757804",
  phone: "3236142546",
  email: "straightwireelectric@gmail.com",
  estimate: {
    title: "Quote",
    defaultNotes: DEFAULT_NOTES_TEXT
  }
};

let CURRENT_ESTIMATE_DATA = null;
let CURRENT_BREAKDOWN = null;
let CURRENT_ITEMS = [];
let CURRENT_TOTAL = 0;
let QUOTE_NUMBER_READY_PROMISE = null;
let PRO_MODE_ACTIVE = false;
let PRO_ACTIONS_MODULE = null;

function resolveDeliveryMode(data, urlParams) {
  const modeFromUrl = String(urlParams?.get("mode") || "").trim().toLowerCase();
  if (modeFromUrl === "internal") return "internal";

  const modeFromData = String(data?.deliveryMode || "").trim().toLowerCase();
  if (modeFromData === "internal") return "internal";

  return "client";
}

function getPostProposalRedirectUrl() {
  const role = String(CURRENT_ESTIMATE_DATA?.createdByRole || "").trim().toLowerCase();
  return role === "boss" ? "panel-jefe.html" : "panel-empleado.html";
}

document.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const proFromUrl = urlParams.get("pro") === "1";
  const data = JSON.parse(localStorage.getItem("estimate"));

  await hydrateCompanyProfile();

  if (!(await ensureProAccess(data || { isProEstimate: proFromUrl }))) {
    return;
  }

  if (!data) {
    console.log("No estimate data found");
    return;
  }

  // Check if this is a proposal flow (has requestId)
  const IS_PROPOSAL_FLOW = !!data.requestId;
  const REQUEST_ID = data.requestId;
  const DELIVERY_MODE = resolveDeliveryMode(data, urlParams);
  const SHOULD_SEND_PROPOSAL = IS_PROPOSAL_FLOW && DELIVERY_MODE !== "internal";
  CURRENT_ESTIMATE_DATA = {
    ...data,
    deliveryMode: DELIVERY_MODE
  };
  const clientProfile = resolveClientProfile(data);

  const quoteDate = buildQuoteDate(data);

  setText("quoteNumber", buildQuoteNumber(data));
  setText("quoteDate", quoteDate);
  setQuoteCreator(resolveCreatorMeta(data));
  hydrateCreatorMeta(data);
  setText("clientNameValue", clientProfile.client || "N/A");
  setText("clientPhoneValue", clientProfile.phone || "N/A");
  setText("clientEmailValue", clientProfile.email || "N/A");
  setText("billingAddressValue", clientProfile.billingAddress || "N/A");
  setText("serviceAddressValue", clientProfile.serviceAddress || "N/A");

  const clientEmailLine = document.getElementById("clientEmailLine");
  if (clientEmailLine) {
    clientEmailLine.style.display = clientProfile.email ? "block" : "none";
  }

  const notesInput = document.getElementById("notesInput");
  const resetNotesBtn = document.getElementById("resetNotesBtn");
  if (notesInput) {
    notesInput.value = resolveInitialNotes(data);
    autosizeNotesEditor(notesInput);
    syncNotesPreview();
    notesInput.addEventListener("input", () => {
      autosizeNotesEditor(notesInput);
      syncNotesPreview();
      try {
        localStorage.setItem(NOTES_DRAFT_STORAGE_KEY, notesInput.value || "");
      } catch (_) {
        // ignore storage restrictions
      }
    });
  }
  if (resetNotesBtn && notesInput) {
    resetNotesBtn.addEventListener("click", () => {
      notesInput.value = getDefaultNotesText();
      autosizeNotesEditor(notesInput);
      syncNotesPreview();
      notesInput.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  let subtotal = 0;
  let serviceSubtotal = 0;
  let materialSubtotal = 0;
  const rows = document.getElementById("rows");
  rows.innerHTML = "";

  if (Array.isArray(data.items) && data.items.length > 0) {
    data.items.forEach(i => {
      const qty = i.qty ?? "";
      const desc = i.desc ?? "";
      const type = (i.type || "").toLowerCase();
      const typeLabel = type === "material" ? "Material" : "Service";
      const price = parseFloat(i.price) || 0;
      const amount = parseFloat(i.amount) || 0;

      subtotal += amount;
      if (type === "material") materialSubtotal += amount;
      else serviceSubtotal += amount;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${desc}</td>
        <td>${typeLabel}</td>
        <td>${qty}</td>
        <td>$${price.toFixed(2)}</td>
        <td>$${amount.toFixed(2)}</td>
      `;
      rows.appendChild(tr);
    });
  }

  const taxRate = parseFloat(data.tax) || 0;
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;
  const breakdown = {
    serviceTotal: serviceSubtotal,
    materialTotal: materialSubtotal,
    subtotal,
    taxRate,
    taxAmount,
    total
  };
  CURRENT_BREAKDOWN = breakdown;
  CURRENT_ITEMS = Array.isArray(data.items) ? data.items : [];
  CURRENT_TOTAL = total;

  document.getElementById("subtotalDisplay").innerText = subtotal.toFixed(2);
  document.getElementById("taxRateDisplay").innerText = taxRate.toFixed(0);
  document.getElementById("taxAmountDisplay").innerText = taxAmount.toFixed(2);
  document.getElementById("totalDisplay").innerText = total.toFixed(2);

  // Update button text based on flow
  const btn = document.getElementById("pdfBtn");
  if (SHOULD_SEND_PROPOSAL) {
    btn.textContent = "Generate PDF and Send Proposal";
    btn.style.background = "#22c55e";
    btn.style.color = "#fff";
  } else if (DELIVERY_MODE === "internal") {
    btn.textContent = "Generate Internal PDF";
    btn.style.background = "#2563eb";
    btn.style.color = "#fff";
  } else {
    btn.textContent = "Generate PDF";
    btn.style.background = "#2563eb";
    btn.style.color = "#fff";
  }

  QUOTE_NUMBER_READY_PROMISE = ensureSequentialQuoteNumber(data);

  btn.addEventListener("click", async () => {
    if (QUOTE_NUMBER_READY_PROMISE) {
      try {
        await QUOTE_NUMBER_READY_PROMISE;
      } catch (quoteErr) {
        alert(`Error: ${quoteErr.message || "No se pudo generar Quote No."}`);
        return;
      }
    }

    if (SHOULD_SEND_PROPOSAL) {
      const notesText = getCurrentNotesText();
      generateAndSendProposal(REQUEST_ID, total, breakdown, data.items || [], notesText);
    } else {
      makePDF();
    }
  });
});

function getDefaultNotesText() {
  return String(COMPANY_PROFILE?.estimate?.defaultNotes || DEFAULT_NOTES_TEXT).trim() || DEFAULT_NOTES_TEXT;
}

function applyCompanyProfileToEstimateDom() {
  setText("companyDisplayNameValue", COMPANY_PROFILE.displayName || "");
  setText("companyAddressValue", COMPANY_PROFILE.address || "");
  setText("companyEinValue", COMPANY_PROFILE.ein || "");
  setText("companyPhoneValue", COMPANY_PROFILE.phone || "");
  setText("companyEmailValue", COMPANY_PROFILE.email || "");
  setText("quoteTitleText", COMPANY_PROFILE?.estimate?.title || "Quote");

  const logo = document.getElementById("companyLogo");
  if (logo && COMPANY_PROFILE.logoUrl) {
    logo.src = COMPANY_PROFILE.logoUrl;
    logo.alt = COMPANY_PROFILE.displayName || "Company Logo";
  }

  document.title = `${COMPANY_PROFILE.displayName || "Estimate"} | Estimate Preview`;
}

async function hydrateCompanyProfile() {
  try {
    const companyConfigModule = await import("./company-config.js?v=20260228e");
    const config = await companyConfigModule.loadCompanyConfig();
    const merged = companyConfigModule.mergeCompanyConfig(COMPANY_PROFILE, config);
    Object.assign(COMPANY_PROFILE, merged);
    COMPANY_PROFILE.estimate = merged.estimate;
  } catch (error) {
    console.warn("[company-config] Falling back to local estimate company profile", error);
  }

  applyCompanyProfileToEstimateDom();
}

function isProFlowEnabled(data) {
  const params = new URLSearchParams(window.location.search);
  if (params.get("pro") === "1") return true;
  return data?.isProEstimate === true;
}

async function ensureProAccess(data) {
  PRO_MODE_ACTIVE = isProFlowEnabled(data);
  if (!PRO_MODE_ACTIVE) return true;

  try {
    if (!PRO_ACTIONS_MODULE) {
      PRO_ACTIONS_MODULE = await import("./pro-actions.js");
    }

    const profile = await PRO_ACTIONS_MODULE.getCurrentUserProfile();
    const access = await PRO_ACTIONS_MODULE.requireProActionsAccess({
      profile,
      redirectTo: "panel-empleado.html",
      showAlert: true
    });

    return !!access.allowed;
  } catch (error) {
    console.error("[pro-actions] access check failed", error);
    alert("No autorizado");
    window.location.href = "panel-empleado.html";
    return false;
  }
}

async function logProEstimateEvent(action, metadata = {}) {
  if (!PRO_MODE_ACTIVE) return;

  try {
    if (!PRO_ACTIONS_MODULE) {
      PRO_ACTIONS_MODULE = await import("./pro-actions.js");
    }
    await PRO_ACTIONS_MODULE.logProAction(action, metadata);
  } catch (error) {
    console.warn("[pro-actions] log failed", error);
  }
}

function resolveInitialNotes(data) {
  if (typeof data?.notes === "string" && data.notes.trim()) return data.notes.trim();
  try {
    const draft = localStorage.getItem(NOTES_DRAFT_STORAGE_KEY);
    if (typeof draft === "string" && draft.trim()) return draft.trim();
  } catch (_) {
    // ignore storage restrictions
  }
  return getDefaultNotesText();
}

function getCurrentNotesText() {
  const input = document.getElementById("notesInput");
  if (!input) return getDefaultNotesText();
  const value = String(input.value || "").trim();
  return value || getDefaultNotesText();
}

function normalizeField(value) {
  return typeof value === "string" ? value.trim() : "";
}

function setText(elementId, value) {
  const node = document.getElementById(elementId);
  if (!node) return;
  node.textContent = value ?? "";
}

function buildEmployeeIdentifier(rawSource) {
  const source = normalizeField(rawSource);
  if (!source) return "";
  const token = source.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (!token) return "";
  const tail = token.length <= 6 ? token : token.slice(-6);
  return `EMP-${tail}`;
}

function resolveCreatorMeta(data) {
  const createdBy = data?.createdBy && typeof data.createdBy === "object" ? data.createdBy : {};
  const uid = normalizeField(createdBy.uid || data?.createdByUid);
  const email = normalizeField(createdBy.email || data?.createdByEmail);
  const name = normalizeField(createdBy.name || data?.createdByName || localStorage.getItem("employeeName"));
  const explicitCode = normalizeField(createdBy.employeeCode || data?.createdByCode);
  const employeeCode = explicitCode || buildEmployeeIdentifier(uid || email || name);

  return {
    uid,
    email,
    name,
    employeeCode
  };
}

function setQuoteCreator(meta) {
  const code = normalizeField(meta?.employeeCode);
  const name = normalizeField(meta?.name);
  const shortName = name.length > 32 ? `${name.slice(0, 32).trim()}...` : name;
  const display = code
    ? (shortName ? `${code} (${shortName})` : code)
    : (shortName || "N/A");
  setText("quoteCreatorId", display);
}

async function hydrateCreatorMeta(data) {
  try {
    const user = await waitForAuth();
    if (!user || !data || typeof data !== "object") return;

    const current = resolveCreatorMeta(data);
    const uid = normalizeField(user.uid);
    const email = normalizeField(user.email);
    const name = normalizeField(user.displayName || current.name || localStorage.getItem("employeeName"));
    const employeeCode = buildEmployeeIdentifier(uid || email || name) || current.employeeCode;

    const nextMeta = { uid, email, name, employeeCode };
    data.createdBy = nextMeta;
    CURRENT_ESTIMATE_DATA = data;
    setQuoteCreator(nextMeta);
    persistEstimateData(data);
    syncEstimateHistoryEntry(data);
  } catch (_) {
    // keep fallback creator label
  }
}

function extractEmail(value) {
  const source = normalizeField(value);
  if (!source) return "";
  const match = source.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0] : "";
}

function resolveClientProfile(data) {
  const client = normalizeField(data?.client);
  const billingAddress = normalizeField(data?.billingAddress || data?.address);
  const explicitService = normalizeField(data?.serviceAddress || data?.jobSiteAddress || data?.shippingAddress);
  const serviceAddress = explicitService || billingAddress;

  const legacyContact = normalizeField(data?.contact);
  let phone = normalizeField(data?.phone || data?.clientPhone);
  let email = normalizeField(data?.email || data?.clientEmail);

  if (!email && legacyContact) {
    email = extractEmail(legacyContact);
  }

  if (!phone && legacyContact) {
    const phoneCandidate = legacyContact.replace(email, "").replace(/[\/|,-]\s*$/, "").trim();
    phone = phoneCandidate || legacyContact;
  }

  const contact = normalizeField([phone, email].filter(Boolean).join(" / ") || legacyContact);

  return {
    client,
    phone,
    email,
    contact,
    billingAddress,
    serviceAddress
  };
}

function getApiBaseUrl() {
  return getApiBase(window);
}

function isValidQuoteNumber(value) {
  return typeof value === "string" && /^QU\d{6,}$/.test(value.trim().toUpperCase());
}

function persistEstimateData(data) {
  if (!data || typeof data !== "object") return;
  try {
    localStorage.setItem("estimate", JSON.stringify(data));
  } catch (_) {
    // ignore storage restrictions
  }
}

async function fetchNextQuoteNumberFromServer() {
  const user = await waitForAuth();
  if (!user) {
    throw new Error("No estas autenticado para generar Quote No.");
  }

  const token = await user.getIdToken();
  if (!token) {
    throw new Error("No se pudo obtener token de autenticacion.");
  }

  const API_BASE = getApiBaseUrl();
  const response = await fetch(`${API_BASE}/api/marketplace/quote-number/next`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "ngrok-skip-browser-warning": "true",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({})
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `Quote number failed: ${response.status}`);
  }

  const result = await response.json().catch(() => ({}));
  const quoteNumber = result?.data?.quoteNumber;
  if (!isValidQuoteNumber(quoteNumber)) {
    throw new Error("El backend devolvio un Quote No invalido.");
  }
  return quoteNumber.trim().toUpperCase();
}

async function ensureSequentialQuoteNumber(data) {
  if (!data || typeof data !== "object") return;

  const existingQuote = typeof data.quoteNumber === "string" ? data.quoteNumber.trim().toUpperCase() : "";
  if (isValidQuoteNumber(existingQuote)) {
    document.getElementById("quoteNumber").innerText = existingQuote;
    syncEstimateHistoryEntry(data);
    return;
  }

  const newQuote = await fetchNextQuoteNumberFromServer();
  data.quoteNumber = newQuote;
  CURRENT_ESTIMATE_DATA = data;
  document.getElementById("quoteNumber").innerText = newQuote;
  persistEstimateData(data);
  syncEstimateHistoryEntry(data);
}

function syncEstimateHistoryEntry(data) {
  const historyId = normalizeField(data?.historyId);
  if (!historyId) return;

  try {
    const rawHistory = localStorage.getItem(ESTIMATE_HISTORY_STORAGE_KEY);
    const parsed = rawHistory ? JSON.parse(rawHistory) : [];
    if (!Array.isArray(parsed)) return;

    const index = parsed.findIndex((entry) => normalizeField(entry?.id) === historyId);
    if (index === -1) return;

    const creatorMeta = resolveCreatorMeta(data);
    const quoteNumber = normalizeField(data?.quoteNumber || data?.quoteNo).toUpperCase();
    const quoteDate = normalizeField(data?.quoteDate) || buildQuoteDate(data);
    const current = parsed[index] || {};

    parsed[index] = {
      ...current,
      quoteNumber: quoteNumber || current.quoteNumber || "",
      quoteDate: quoteDate || current.quoteDate || "",
      createdByName: creatorMeta.name || current.createdByName || "",
      createdByCode: creatorMeta.employeeCode || current.createdByCode || "",
      estimateSnapshot: data
    };

    localStorage.setItem(ESTIMATE_HISTORY_STORAGE_KEY, JSON.stringify(parsed));
  } catch (_) {
    // ignore malformed local history
  }
}
function normalizeEstimateItems(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => {
    const qty = Number(item?.qty);
    const price = Number(item?.price);
    const amount = Number(item?.amount);
    const resolvedQty = Number.isFinite(qty) ? qty : 0;
    const resolvedPrice = Number.isFinite(price) ? price : 0;
    const resolvedAmount = Number.isFinite(amount) ? amount : resolvedQty * resolvedPrice;
    const rawType = String(item?.type || "").toLowerCase();
    return {
      desc: String(item?.desc || ""),
      type: rawType === "material" ? "material" : "service",
      qty: resolvedQty,
      price: resolvedPrice,
      amount: resolvedAmount
    };
  });
}

function buildServerPdfPayload() {
  const data = CURRENT_ESTIMATE_DATA || JSON.parse(localStorage.getItem("estimate") || "{}");
  const clientProfile = resolveClientProfile(data);
  const creatorMeta = resolveCreatorMeta(data);
  const quoteNumberFromDom = document.getElementById("quoteNumber")?.innerText?.trim();
  const quoteDateFromDom = document.getElementById("quoteDate")?.innerText?.trim();
  const items = normalizeEstimateItems(CURRENT_ITEMS.length ? CURRENT_ITEMS : data.items || []);
  const taxRate = Number(data?.tax);
  const safeTaxRate = Number.isFinite(taxRate) ? taxRate : Number(CURRENT_BREAKDOWN?.taxRate || 0);

  return {
    quoteNumber: quoteNumberFromDom || buildQuoteNumber(data),
    quoteDate: quoteDateFromDom || buildQuoteDate(data),
    client: clientProfile.client,
    phone: clientProfile.phone,
    email: clientProfile.email,
    contact: clientProfile.contact,
    billingAddress: clientProfile.billingAddress,
    serviceAddress: clientProfile.serviceAddress,
    shippingAddress: clientProfile.serviceAddress,
    createdBy: creatorMeta,
    quoteCreatorId: creatorMeta.employeeCode,
    notes: getCurrentNotesText(),
    taxRate: safeTaxRate,
    breakdown: CURRENT_BREAKDOWN || null,
    items,
    company: JSON.parse(JSON.stringify(COMPANY_PROFILE))
  };
}

function normalizePdfBlob(blob) {
  if (!(blob instanceof Blob)) return null;
  if (blob.type === "application/pdf") return blob;
  return new Blob([blob], { type: "application/pdf" });
}

function downloadPdfBlob(blob, filename) {
  const link = document.createElement("a");
  const objectUrl = URL.createObjectURL(blob);
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

function autosizeNotesEditor(input) {
  if (!input) return;
  input.style.height = "0px";
  input.style.height = `${Math.max(130, input.scrollHeight)}px`;
}

function getPageCapacityPx(element) {
  const width = Math.max(1, element.getBoundingClientRect().width);
  return width * PAGE_CONTENT_RATIO;
}

function shouldUseManualTablePagination() {
  return false;
}

function applyExportPagination(element) {
  if (!element || EXPORT_LAYOUT_STATE.has(element)) return;

  const table = element.querySelector(".estimate-table");
  const tbody = table ? table.querySelector("tbody") : null;
  const rows = tbody ? Array.from(tbody.querySelectorAll("tr")) : [];
  const state = {
    tableOriginal: null,
    tableWrapper: null,
    tableParent: null,
    tableNextSibling: null
  };

  if (!shouldUseManualTablePagination()) {
    EXPORT_LAYOUT_STATE.set(element, state);
    return;
  }

  const pageCapacity = getPageCapacityPx(element);

  if (table && tbody && rows.length > 0) {
    const thead = table.querySelector("thead");
    const theadHeight = thead ? Math.max(1, thead.offsetHeight) : 0;
    const firstPageLimit = Math.max(120, pageCapacity - table.offsetTop - 8);
    const nextPageLimit = Math.max(120, pageCapacity - 12);

    const chunks = [];
    let currentChunk = [];
    let currentLimit = firstPageLimit;
    let usedHeight = theadHeight;

    rows.forEach((row) => {
      const rowHeight = Math.max(20, row.offsetHeight || 0);
      const willOverflow = currentChunk.length > 0 && usedHeight + rowHeight > currentLimit;
      if (willOverflow) {
        chunks.push(currentChunk);
        currentChunk = [];
        currentLimit = nextPageLimit;
        usedHeight = theadHeight;
      }
      currentChunk.push(row.cloneNode(true));
      usedHeight += rowHeight;
    });

    if (currentChunk.length > 0) chunks.push(currentChunk);

    if (chunks.length > 1) {
      const wrapper = document.createElement("div");
      wrapper.className = "pdf-table-pages";
      const tableClass = table.className;
      const tableStyle = table.getAttribute("style");

      chunks.forEach((chunkRows, index) => {
        const newTable = document.createElement("table");
        newTable.className = tableClass;
        if (tableStyle) newTable.setAttribute("style", tableStyle);
        if (thead) newTable.appendChild(thead.cloneNode(true));

        const newBody = document.createElement("tbody");
        if (index === 0 && tbody.id) newBody.id = tbody.id;
        chunkRows.forEach((clonedRow) => newBody.appendChild(clonedRow));
        newTable.appendChild(newBody);
        if (index > 0) newTable.classList.add("estimate-table-continuation");
        wrapper.appendChild(newTable);
      });

      const parent = table.parentNode;
      if (parent) {
        state.tableOriginal = table;
        state.tableParent = parent;
        state.tableNextSibling = table.nextSibling;
        state.tableWrapper = wrapper;
        parent.insertBefore(wrapper, table);
        parent.removeChild(table);
      }
    }
  }

  EXPORT_LAYOUT_STATE.set(element, state);
}

function applyTotalsPageBreak(element) {
  if (!element) return;
  const totals = element.querySelector(".totals-box");
  if (!totals) return;

  totals.classList.remove("force-page-break-before");

  const pageCapacity = getPageCapacityPx(element);
  const totalsTop = Math.max(0, totals.offsetTop || 0);
  const totalsHeight = Math.max(44, totals.offsetHeight || 0);
  const offsetInPage = totalsTop % pageCapacity;
  const spaceLeft = pageCapacity - offsetInPage;

  if (spaceLeft < totalsHeight + 8) {
    totals.classList.add("force-page-break-before");
  }
}

function restoreExportPagination(element) {
  const state = EXPORT_LAYOUT_STATE.get(element);
  if (!state) return;

  if (state.tableOriginal && state.tableWrapper && state.tableParent) {
    state.tableParent.insertBefore(state.tableOriginal, state.tableWrapper);
    state.tableParent.removeChild(state.tableWrapper);
  }

  EXPORT_LAYOUT_STATE.delete(element);
}

function syncNotesPreview() {
  const input = document.getElementById("notesInput");
  const preview = document.getElementById("notesPreview");
  if (!input || !preview) return;
  preview.textContent = input.value || "";
}

function buildQuoteNumber(data) {
  if (typeof data?.quoteNumber === "string" && data.quoteNumber.trim()) {
    return data.quoteNumber.trim().toUpperCase();
  }
  if (typeof data?.quoteNo === "string" && data.quoteNo.trim()) {
    return data.quoteNo.trim().toUpperCase();
  }
  return "QU000000";
}

function buildQuoteDate(data) {
  if (typeof data?.quoteDate === "string" && data.quoteDate.trim()) return data.quoteDate.trim();
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const month = now.toLocaleString("en-US", { month: "short" });
  const year = now.getFullYear();
  return `${day}/${month}/${year}`;
}

function nextFrame() {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

function isIOSDevice() {
  const ua = navigator.userAgent || "";
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isIpadOS = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return isIOS || isIpadOS;
}

function isMacOSDevice() {
  const ua = navigator.userAgent || "";
  const platform = navigator.platform || "";
  return /Macintosh|Mac OS X|MacIntel/.test(ua) || /^Mac/.test(platform);
}

function getElementRenderSize(element) {
  const rect = element.getBoundingClientRect();
  return {
    width: Math.ceil(
      Math.max(rect.width || 0, element.scrollWidth || 0, element.offsetWidth || 0, element.clientWidth || 0)
    ),
    height: Math.ceil(
      Math.max(rect.height || 0, element.scrollHeight || 0, element.offsetHeight || 0, element.clientHeight || 0)
    )
  };
}

function getSafeCanvasScale(width, height, preferredScale, isApple) {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const maxDimension = isApple ? 8192 : 16384;
  const maxArea = isApple ? 14000000 : 64000000;
  const scaleByDimension = Math.min(maxDimension / safeWidth, maxDimension / safeHeight);
  const scaleByArea = Math.sqrt(maxArea / (safeWidth * safeHeight));
  const safeScale = Math.min(preferredScale, scaleByDimension, scaleByArea);
  return Number(Math.max(0.3, safeScale).toFixed(2));
}

function buildPdfOptions(element) {
  const isIOS = isIOSDevice();
  const isMac = isMacOSDevice();
  const isApple = isIOS || isMac;
  const { width, height } = getElementRenderSize(element);
  const preferredScale = isIOS ? 1.3 : (isMac ? 1.2 : 2);
  const safeScale = getSafeCanvasScale(width, height, preferredScale, isApple);
  const pagebreakMode = isIOS ? ["avoid-all", "css", "legacy"] : ["css", "legacy"];
  const avoidSelectors = [
    "tr",
    ".company-header",
    ".client-info-grid",
    ".client-info-card",
    ".totals-box"
  ];

  console.log(
    `[PDF] viewport=${width}x${height} platform=${isIOS ? "ios" : isMac ? "mac" : "other"} preferredScale=${preferredScale} safeScale=${safeScale}`
  );

  return {
    margin: [10, 10, 10, 10],
    image: { type: "jpeg", quality: isApple ? 0.92 : 0.98 },
    pagebreak: {
      mode: pagebreakMode,
      avoid: avoidSelectors
    },
    html2canvas: {
      scale: safeScale,
      useCORS: true,
      backgroundColor: "#ffffff",
      letterRendering: true,
      logging: false,
      scrollX: 0,
      scrollY: 0,
      windowWidth: Math.max(width, document.documentElement.clientWidth || width),
      onclone: (clonedDoc) => {
        clonedDoc.documentElement.style.overflow = "visible";
        clonedDoc.body.style.overflow = "visible";
      }
    },
    jsPDF: { unit: "mm", format: "letter", orientation: "portrait" }
  };
}

async function waitForImages(container) {
  const images = Array.from(container.querySelectorAll("img"));
  if (!images.length) return;

  await Promise.all(
    images.map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return new Promise((resolve) => {
        const done = () => {
          img.removeEventListener("load", done);
          img.removeEventListener("error", done);
          resolve();
        };
        img.addEventListener("load", done);
        img.addEventListener("error", done);
        setTimeout(done, 3000);
      });
    })
  );
}

async function preparePdfExport(element, btn) {
  const prevScrollX = window.scrollX || window.pageXOffset || 0;
  const prevScrollY = window.scrollY || window.pageYOffset || 0;
  element.dataset.prevScrollX = String(prevScrollX);
  element.dataset.prevScrollY = String(prevScrollY);
  window.scrollTo(0, 0);

  if (btn) btn.style.display = "none";
  document.body.classList.add("pdf-root");
  element.classList.add("pdf-export-mode");
  if (isIOSDevice()) {
    element.classList.add("pdf-export-ios");
  } else if (isMacOSDevice()) {
    element.classList.add("pdf-export-mac");
  }

  autosizeNotesEditor(element.querySelector("#notesInput"));
  toggleNotesRenderMode(element, true);
  element.querySelectorAll(".force-page-break, .force-page-break-before").forEach((node) => {
    node.classList.remove("force-page-break");
    node.classList.remove("force-page-break-before");
  });
  await nextFrame();
  applyTotalsPageBreak(element);

  if (document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch (_) {
      // ignore font loading failures
    }
  }

  await waitForImages(element);
  await nextFrame();
  await nextFrame();
  applyTotalsPageBreak(element);
}

function cleanupPdfExport(element, btn) {
  const prevScrollX = Number(element.dataset.prevScrollX || 0);
  const prevScrollY = Number(element.dataset.prevScrollY || 0);

  const footer = element.querySelector(".footer-section");
  if (footer) footer.classList.remove("force-page-break");
  element.querySelectorAll(".force-page-break, .force-page-break-before").forEach((node) => {
    node.classList.remove("force-page-break");
    node.classList.remove("force-page-break-before");
  });
  toggleNotesRenderMode(element, false);

  element.classList.remove("pdf-export-mode");
  element.classList.remove("pdf-export-ios");
  element.classList.remove("pdf-export-mac");
  document.body.classList.remove("pdf-root");
  if (btn) btn.style.display = "block";

  delete element.dataset.prevScrollX;
  delete element.dataset.prevScrollY;
  window.scrollTo(prevScrollX, prevScrollY);
}

function toggleNotesRenderMode(element, exportMode) {
  const notesInput = element.querySelector("#notesInput");
  const notesPreview = element.querySelector("#notesPreview");
  if (!notesInput || !notesPreview) return;

  notesPreview.textContent = notesInput.value || "";
  if (exportMode) {
    notesInput.style.display = "none";
    notesPreview.style.display = "block";
  } else {
    notesPreview.style.display = "none";
    notesInput.style.display = "block";
  }
}

async function generatePdfBlobServerSide() {
  const user = await waitForAuth();
  if (!user) {
    throw new Error("No estas autenticado para generar el PDF.");
  }

  const token = await user.getIdToken();
  if (!token) {
    throw new Error("No se pudo obtener el token de autenticacion.");
  }

  const API_BASE = getApiBaseUrl();
  const payload = buildServerPdfPayload();

  const response = await fetch(`${API_BASE}/api/marketplace/render-estimate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "ngrok-skip-browser-warning": "true",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `Server PDF failed: ${response.status}`);
  }

  const blob = normalizePdfBlob(await response.blob());
  if (!blob || blob.size < 1000) {
    throw new Error("El servidor devolvio un PDF vacio o invalido.");
  }

  return blob;
}

async function generatePdfBlobClientFallback(element, btn) {
  await preparePdfExport(element, btn);
  try {
    const opt = buildPdfOptions(element);
    let pdfBlob = await html2pdf().set(opt).from(element).output("blob");
    pdfBlob = normalizePdfBlob(pdfBlob);
    if (!pdfBlob || pdfBlob.size < 1000) {
      throw new Error("Fallback PDF corrupto o vacio.");
    }
    return pdfBlob;
  } finally {
    cleanupPdfExport(element, btn);
  }
}

async function makePDF() {
  const btn = document.getElementById("pdfBtn");
  const originalText = btn ? btn.textContent : "";
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Generating PDF...";
  }
  try {
    const pdfBlob = await generatePdfBlobServerSide();
    downloadPdfBlob(pdfBlob, `Estimate_${Date.now()}.pdf`);
    await logProEstimateEvent("EXPORT", {
      source: "estimate-template.html",
      exportType: "pdf-download",
      estimateId: String(CURRENT_ESTIMATE_DATA?.historyId || ""),
      quoteNumber: String(document.getElementById("quoteNumber")?.innerText || "").trim().toUpperCase(),
      total: Number(CURRENT_TOTAL || 0)
    });
  } catch (error) {
    console.error("makePDF error:", error);
    alert(`Error: ${error.message || "No se pudo generar el PDF en servidor."}\nVerifica que el backend este corriendo y que tu sesion este activa.`);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }
}

// ========== PROPOSAL FLOW ==========

async function generateAndSendProposal(requestId, totalAmount, breakdown, items, notesText) {
  const btn = document.getElementById("pdfBtn");
  const originalText = btn.textContent;

  btn.disabled = true;
  btn.textContent = "Generating PDF...";

  try {
    const pdfBlob = await generatePdfBlobServerSide();
    console.log(`[PDF] Server render size: ${pdfBlob.size} bytes`);

    btn.textContent = "Uploading PDF...";

    // 2. Upload to Cloudinary via backend
    const pdfUrl = await uploadPdfToCloudinary(pdfBlob);

    btn.textContent = "Sending proposal...";

    // 3. Send proposal with PDF URL
    await sendProposalWithPdf(requestId, totalAmount, pdfUrl, breakdown, items, notesText);
    await logProEstimateEvent("EXPORT", {
      source: "estimate-template.html",
      exportType: "proposal-send",
      requestId: String(requestId || ""),
      estimateId: String(CURRENT_ESTIMATE_DATA?.historyId || ""),
      quoteNumber: String(document.getElementById("quoteNumber")?.innerText || "").trim().toUpperCase(),
      total: Number(totalAmount || 0)
    });

    // 4. Clean up and redirect
    localStorage.removeItem("estimate");
    try {
      localStorage.removeItem(NOTES_DRAFT_STORAGE_KEY);
    } catch (_) {
      // ignore storage restrictions
    }
    alert("Propuesta enviada con exito.");
    window.location.href = getPostProposalRedirectUrl();

  } catch (error) {
    console.error("Error in proposal flow:", error);
    alert("Error: " + (error.message || "No se pudo enviar la propuesta") + "\nVerifica backend y sesion activa.");
    btn.disabled = false;
    btn.textContent = originalText;
  } finally {
    if (btn.disabled) {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }
}
// Helper to ensure we have a user token
async function waitForAuth() {
  // Use global firebase logic or dynamic import. 
  // Assuming firebase.js is a module that exports auth/onAuthStateChanged
  const fb = await import('./firebase.js');
  // Handle both default/named exports just in case
  const auth = fb.auth;
  const onAuthStateChanged = fb.onAuthStateChanged;

  if (!auth || typeof onAuthStateChanged !== 'function') {
    throw new Error("Firebase Auth not initialized correctly.");
  }

  return new Promise((resolve, reject) => {
    // If already initialized
    if (auth.currentUser) return resolve(auth.currentUser);

    // Wait for change
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      if (user) resolve(user);
      // We don't reject immediately here because user might be null initially then sign in
      // But in this flow, we assume they ARE logged in from the previous page.
      // If null, we might need to wait or fail. 
      // Given the flow, if we get null, it's likely they aren't signed in.
      else reject(new Error("No estas autenticado."));
    });

    // Safety timeout? Maybe 10s
    setTimeout(() => {
      // If still pending...
      if (auth.currentUser) resolve(auth.currentUser);
      else reject(new Error("Timeout waiting for auth."));
    }, 5000);
  });
}

// Helper: Upload to backend
// Helper: Upload to backend
async function uploadPdfToCloudinary(blob) {
  const formData = new FormData();
  formData.append("file", blob, "expert_estimate.pdf");

  // Ensure auth
  const user = await waitForAuth();
  const token = await user.getIdToken();

  if (!token) {
    throw new Error("No estas autenticado. Por favor inicia sesion.");
  }

  const API_BASE = getApiBaseUrl();

  const response = await fetch(`${API_BASE}/api/marketplace/upload-estimate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'ngrok-skip-browser-warning': 'true'
    },
    body: formData
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `Upload failed: ${response.status}`);
  }

  // Backend should return { ok: true, data: { public_id, resource_type, type, ... } }
  const result = await response.json();
  return result.data;
}

async function sendProposalWithPdf(requestId, amount, estimatePdfUrl, breakdown, items, notesText) {
  const { auth } = await import('./firebase.js');
  const token = await auth.currentUser?.getIdToken();

  if (!token) {
    throw new Error("No estas autenticado. Por favor inicia sesion.");
  }

  const API_BASE = getApiBaseUrl();

  const payload = {
    amount: Number(amount),
    notes: typeof notesText === "string" && notesText.trim() ? notesText.trim() : "Ver estimado PDF adjunto"
  };

  const quoteNumber = document.getElementById("quoteNumber")?.innerText?.trim()?.toUpperCase();
  const quoteDate = document.getElementById("quoteDate")?.innerText?.trim();
  const creatorMeta = resolveCreatorMeta(CURRENT_ESTIMATE_DATA || {});
  if (isValidQuoteNumber(quoteNumber)) payload.quoteNumber = quoteNumber;
  if (quoteDate) payload.quoteDate = quoteDate;
  if (creatorMeta.employeeCode) payload.quoteCreatorId = creatorMeta.employeeCode;
  if (creatorMeta.uid || creatorMeta.email || creatorMeta.name) payload.createdBy = creatorMeta;

  if (breakdown && typeof breakdown === 'object') {
    payload.breakdown = breakdown;
  }
  if (Array.isArray(items)) {
    payload.items = items;
  }

  // Fix: If object (metadata), send as estimatePdf. If string (legacy), estimatePdfUrl.
  if (estimatePdfUrl && typeof estimatePdfUrl === 'object') {
    payload.estimatePdf = estimatePdfUrl;
  } else {
    payload.estimatePdfUrl = estimatePdfUrl;
  }

  const response = await fetch(`${API_BASE}/api/marketplace/requests/${requestId}/proposal`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'ngrok-skip-browser-warning': 'true',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `Proposal failed: ${response.status}`);
  }

  return response.json();
}


