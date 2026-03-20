import { runProjectionSafe, validateTemplateSafe } from "./engine-adapter.js";

const APP_ID = "UWC";
const APP_VERSION = 1;
const MESSAGE_TYPES = new Set([
  "READY",
  "INIT",
  "LOAD_TEMPLATE",
  "EXPORT_TEMPLATE",
  "SAVE_TEMPLATE",
  "RUN",
  "RESULT",
  "ERROR",
  "PING",
  "PONG"
]);

const STORAGE_KEY = "uwc.templates.v1";
const DEMO_TEMPLATE_PATHS = [
  "./templates/concreto-demo.json",
  "./templates/electricidad-demo.json",
  "./templates/carpinteria-demo.json"
];

const iframe = document.getElementById("uwcBuilder");
const bridgeStatus = document.getElementById("bridgeStatus");
const builderOriginInput = document.getElementById("builderOriginInput");
const hostOriginInput = document.getElementById("hostOriginInput");
const pingBtn = document.getElementById("pingBtn");
const openBuilderTabBtn = document.getElementById("openBuilderTabBtn");
const loadDemosBtn = document.getElementById("loadDemosBtn");
const refreshTemplatesBtn = document.getElementById("refreshTemplatesBtn");
const templateSelect = document.getElementById("templateSelect");
const sendTemplateBtn = document.getElementById("sendTemplateBtn");
const deleteTemplateBtn = document.getElementById("deleteTemplateBtn");
const importTemplateInput = document.getElementById("importTemplateInput");
const runInputs = document.getElementById("runInputs");
const runInBuilderBtn = document.getElementById("runInBuilderBtn");
const runInHostBtn = document.getElementById("runInHostBtn");
const runResult = document.getElementById("runResult");
const runResultRaw = document.getElementById("runResultRaw");
const runTechnicalDetails = document.getElementById("runTechnicalDetails");
const hostLog = document.getElementById("hostLog");
const autoPrepStatus = document.getElementById("autoPrepStatus");
const quickPieces = document.getElementById("quickPieces");
const quickLength = document.getElementById("quickLength");
const quickWidth = document.getElementById("quickWidth");
const quickWastePct = document.getElementById("quickWastePct");
const quickCanvas = document.getElementById("quickCanvas");
const quick3dViewport = document.getElementById("quick3dViewport");
const open3dProBtn = document.getElementById("open3dProBtn");
const quickSummary = document.getElementById("quickSummary");
const iframeWrap = document.querySelector(".iframe-wrap");
const guidedModePanel = document.getElementById("guidedModePanel");
const guidedOpenBuilderBtn = document.getElementById("guidedOpenBuilderBtn");
const guidedOpen3dProBtn = document.getElementById("guidedOpen3dProBtn");
const guidedCoachText = document.getElementById("guidedCoachText");
const guideStepTemplate = document.getElementById("guideStepTemplate");
const guideStepMeasures = document.getElementById("guideStepMeasures");
const guideStepCalculate = document.getElementById("guideStepCalculate");
const guideStepReview = document.getElementById("guideStepReview");
const threeProModal = document.getElementById("threeProModal");
const close3dProBtn = document.getElementById("close3dProBtn");
const pro3dViewport = document.getElementById("pro3dViewport");
const pro3dStatus = document.getElementById("pro3dStatus");
const pro3dFallbackCanvas = document.getElementById("pro3dFallbackCanvas");
const heroSubtitle = document.getElementById("heroSubtitle");
const restartTutorBtn = document.getElementById("restartTutorBtn");

const onboardingOverlay = document.getElementById("onboardingOverlay");
const onboardingTitle = document.getElementById("onboardingTitle");
const onboardingHint = document.getElementById("onboardingHint");
const onboardingOptions = document.getElementById("onboardingOptions");
const onboardingBackBtn = document.getElementById("onboardingBackBtn");
const onboardingSkipBtn = document.getElementById("onboardingSkipBtn");
const onboardingNextBtn = document.getElementById("onboardingNextBtn");
const onboardingDots = Array.from(document.querySelectorAll(".onboarding-dots .dot"));

const pendingRequests = new Map();
let builderReady = false;
let previewMode = "3d";
let currentFlowMode = "guiado";
let hasProjectionResult = false;
let threeLoadErrorLogged = false;
let threeLibPromise = null;
const threeViewers = new Map();

const ONBOARDING_KEY = "uwc.onboarding.v3";
const ONBOARDING_DATA_KEY = "uwc.onboarding.answers.v3";

const query = new URLSearchParams(window.location.search);
const configuredSrc = query.get("builderSrc") || iframe.getAttribute("src") || "/builder-react/dist/index.html";
const builderURL = new URL(configuredSrc, window.location.href);
const builderOrigin = query.get("builderOrigin") || builderURL.origin;
const allowedBuilderOrigins = new Set([builderOrigin]);

builderURL.searchParams.set("hostOrigin", window.location.origin);
iframe.src = builderURL.toString();

builderOriginInput.value = builderOrigin;
hostOriginInput.value = window.location.origin;

const onboardingSteps = [
  {
    key: "projectType",
    title: "Que vas a construir?",
    hint: "Elige lo que mas se parezca a tu trabajo.",
    options: [
      { id: "electricidad", label: "Cableado", desc: "Casas y negocios" },
      { id: "carpinteria", label: "Carpinteria", desc: "Muebles y paneles" },
      { id: "concreto", label: "Concreto", desc: "Losas y obra civil" },
      { id: "otro", label: "Otro", desc: "Empezar desde cero" }
    ]
  },
  {
    key: "flowMode",
    title: "Como quieres trabajar?",
    hint: "Puedes ir guiado o entrar directo al constructor.",
    options: [
      { id: "guiado", label: "Modo guiado", desc: "Recomendado para empezar" },
      { id: "pro", label: "Modo constructor", desc: "Editar todos los detalles" }
    ]
  },
  {
    key: "sizePreset",
    title: "Tamano aproximado del trabajo?",
    hint: "Esto solo ajusta valores iniciales.",
    options: [
      { id: "pequeno", label: "Pequeno", desc: "1 a 10 piezas" },
      { id: "mediano", label: "Mediano", desc: "10 a 40 piezas" },
      { id: "grande", label: "Grande", desc: "40+ piezas" }
    ]
  },
  {
    key: "viewMode",
    title: "Como quieres verlo?",
    hint: "Puedes usar vista 3D o simple.",
    options: [
      { id: "3d", label: "Vista 3D", desc: "Visual fisica en bloques" },
      { id: "2d", label: "Vista simple", desc: "Plano y rapido" }
    ]
  }
];

const onboardingState = {
  stepIndex: 0,
  answers: {
    projectType: null,
    flowMode: null,
    sizePreset: null,
    viewMode: null
  }
};

function getDefaultOnboardingAnswers() {
  return {
    projectType: "carpinteria",
    flowMode: "guiado",
    sizePreset: "mediano",
    viewMode: "3d"
  };
}

function loadSavedOnboardingAnswers() {
  try {
    const raw = localStorage.getItem(ONBOARDING_DATA_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return {
      projectType: typeof parsed.projectType === "string" ? parsed.projectType : null,
      flowMode: typeof parsed.flowMode === "string" ? parsed.flowMode : null,
      sizePreset: typeof parsed.sizePreset === "string" ? parsed.sizePreset : null,
      viewMode: typeof parsed.viewMode === "string" ? parsed.viewMode : null
    };
  } catch {
    return null;
  }
}

function saveOnboardingAnswers() {
  localStorage.setItem(ONBOARDING_DATA_KEY, JSON.stringify(onboardingState.answers));
}

function fillOnboardingDefaults() {
  const defaults = getDefaultOnboardingAnswers();
  onboardingState.answers = {
    projectType: onboardingState.answers.projectType || defaults.projectType,
    flowMode: onboardingState.answers.flowMode || defaults.flowMode,
    sizePreset: onboardingState.answers.sizePreset || defaults.sizePreset,
    viewMode: onboardingState.answers.viewMode || defaults.viewMode
  };
}

function setGuidedMode(enabled) {
  if (!guidedModePanel || !iframe) return;
  guidedModePanel.classList.toggle("hidden", !enabled);
  iframe.classList.toggle("hidden", enabled);
}

function migrateTemplatesIfNeeded() {
  const templates = readTemplates();
  if (!templates.length) return;

  let changed = false;
  const next = templates.map((template) => {
    if (template?.id !== "tpl-carpinteria-v1" || !Array.isArray(template.computed)) {
      return template;
    }

    const computed = template.computed.map((item) => {
      if (item?.key !== "sheetCount") return item;
      const oldExpr = String(item.expr || "").replace(/\s+/g, "");
      if (oldExpr !== "ceil(computed.areaWithWaste/2.88)") return item;
      changed = true;
      return {
        ...item,
        expr: "ceil(round(computed.areaWithWaste / 2.88, 6))"
      };
    });

    if (!changed) return template;
    return {
      ...template,
      version: template.version === "1.0.0" ? "1.0.1" : template.version,
      computed
    };
  });

  if (changed) {
    writeTemplates(next);
    appendLog("Plantillas demo actualizadas (ajuste de redondeo en carpinteria).");
  }
}

function setFlowMode(flowMode) {
  currentFlowMode = flowMode === "pro" ? "pro" : "guiado";
  const guided = currentFlowMode !== "pro";
  setGuidedMode(guided);
  document.querySelectorAll(".advanced-only").forEach((node) => {
    node.classList.toggle("hidden", currentFlowMode !== "pro");
  });

  if (openBuilderTabBtn) {
    openBuilderTabBtn.textContent = guided ? "Mostrar constructor avanzado" : "Abrir constructor en pestana";
  }

  if (guidedModePanel) {
    guidedModePanel.classList.toggle("hidden", !guided);
  }

  updateGuidedCoach();
}

function openStandaloneBuilderTab() {
  const standaloneURL = new URL(iframe.src);
  standaloneURL.searchParams.set("standalone", "1");
  standaloneURL.searchParams.set("t", String(Date.now()));
  const newWindow = window.open(standaloneURL.toString(), "_blank", "noopener,noreferrer");
  if (!newWindow) {
    window.location.href = standaloneURL.toString();
  }
}

function close3DProModal() {
  if (threeProModal) {
    threeProModal.classList.add("hidden");
  }
}

function drawProFallback(data) {
  if (!pro3dFallbackCanvas) return;
  const canvas = pro3dFallbackCanvas;
  const width = Math.max(800, pro3dViewport?.clientWidth || 800);
  const height = Math.max(460, pro3dViewport?.clientHeight || 460);
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#08142e";
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  const scaleX = width / 360;
  const scaleY = height / 220;
  ctx.scale(scaleX, scaleY);
  drawQuickPreview3D(ctx, data, 360, 220);
  ctx.restore();

  ctx.fillStyle = "#9ec3ff";
  ctx.font = "14px Segoe UI";
  ctx.fillText("Vista alternativa activa (motor 3D no disponible).", 18, height - 20);
}

async function open3DProModal() {
  if (!threeProModal || !pro3dViewport) return;
  previewMode = "3d";
  onboardingState.answers.viewMode = "3d";
  saveOnboardingAnswers();
  const data = readQuickInputs();
  threeProModal.classList.remove("hidden");
  if (quick3dViewport) quick3dViewport.classList.remove("hidden");
  if (quickCanvas) quickCanvas.classList.add("hidden");
  if (pro3dStatus) pro3dStatus.textContent = "Cargando motor 3D Pro...";
  if (pro3dFallbackCanvas) pro3dFallbackCanvas.classList.add("hidden");
  if (pro3dViewport) pro3dViewport.classList.remove("hidden");

  const ok = await renderThreePreview(pro3dViewport, data, "pro", true);
  if (ok) {
    if (pro3dStatus) pro3dStatus.textContent = "Listo. Arrastra para rotar. Rueda del mouse para zoom.";
    if (pro3dViewport) pro3dViewport.classList.remove("hidden");
    if (pro3dFallbackCanvas) pro3dFallbackCanvas.classList.add("hidden");
    return;
  }

  if (pro3dStatus) {
    pro3dStatus.textContent = "No se pudo cargar WebGL externo. Mostrando vista alternativa.";
  }
  if (pro3dViewport) pro3dViewport.classList.add("hidden");
  if (pro3dFallbackCanvas) {
    drawProFallback(data);
    pro3dFallbackCanvas.classList.remove("hidden");
  }
}

function nowLabel() {
  return new Date().toISOString();
}

function normalizeText(value) {
  return String(value || "").toLowerCase();
}

function selectTemplateByKeyword(keyword) {
  const target = normalizeText(keyword);
  const options = Array.from(templateSelect.options || []);
  const match = options.find((opt) => normalizeText(opt.textContent).includes(target));
  if (match) templateSelect.value = match.value;
}

async function ensureTemplatesLoaded() {
  const current = readTemplates();
  if (current.length > 0) return;
  await loadDemoTemplates();
}

function applySizePreset(sizePreset) {
  if (!quickPieces || !quickLength || !quickWidth || !quickWastePct) return;
  if (sizePreset === "pequeno") {
    quickPieces.value = "8";
    quickLength.value = "1.2";
    quickWidth.value = "0.35";
    quickWastePct.value = "8";
    return;
  }
  if (sizePreset === "grande") {
    quickPieces.value = "60";
    quickLength.value = "2.4";
    quickWidth.value = "0.8";
    quickWastePct.value = "15";
    return;
  }
  quickPieces.value = "24";
  quickLength.value = "1.8";
  quickWidth.value = "0.45";
  quickWastePct.value = "12";
}

async function applyOnboardingAnswers() {
  fillOnboardingDefaults();
  const { projectType, flowMode, sizePreset, viewMode } = onboardingState.answers;
  previewMode = viewMode === "2d" ? "2d" : "3d";
  setFlowMode(flowMode);

  await ensureTemplatesLoaded();
  renderTemplateList();

  if (projectType === "electricidad") selectTemplateByKeyword("electricidad");
  else if (projectType === "carpinteria") selectTemplateByKeyword("carpinteria");
  else if (projectType === "concreto") selectTemplateByKeyword("concreto");

  applySizePreset(sizePreset || "mediano");
  syncQuickInputsFromForm();
  saveOnboardingAnswers();

  if (heroSubtitle) {
    if (currentFlowMode === "pro") {
      heroSubtitle.textContent = "Modo constructor activo. Puedes editar todo paso a paso.";
    } else {
      heroSubtitle.textContent = "Modo guiado activo. Solo completa 3 pasos y calcula.";
    }
  }

  updateGuidedCoach();
}

function updateOnboardingDots() {
  onboardingDots.forEach((dot, idx) => {
    dot.classList.toggle("active", idx === onboardingState.stepIndex);
  });
}

function renderOnboardingStep() {
  if (!onboardingOverlay || !onboardingTitle || !onboardingHint || !onboardingOptions || !onboardingNextBtn) {
    return;
  }

  const step = onboardingSteps[onboardingState.stepIndex];
  if (!step) return;

  onboardingTitle.textContent = step.title;
  onboardingHint.textContent = step.hint;
  onboardingOptions.innerHTML = "";

  const selected = onboardingState.answers[step.key];
  step.options.forEach((option) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `onboarding-option${selected === option.id ? " active" : ""}`;
    btn.innerHTML = `<span class="title">${option.label}</span><span class="desc">${option.desc}</span>`;
    btn.addEventListener("click", () => {
      onboardingState.answers[step.key] = option.id;
      renderOnboardingStep();
    });
    onboardingOptions.appendChild(btn);
  });

  onboardingBackBtn.disabled = onboardingState.stepIndex === 0;
  onboardingNextBtn.disabled = !onboardingState.answers[step.key];
  onboardingNextBtn.textContent =
    onboardingState.stepIndex === onboardingSteps.length - 1 ? "Empezar" : "Siguiente";

  updateOnboardingDots();
}

async function finishOnboarding(savePreference = true) {
  fillOnboardingDefaults();
  if (savePreference) {
    localStorage.setItem(ONBOARDING_KEY, "1");
    saveOnboardingAnswers();
  }
  onboardingOverlay.classList.add("hidden");
  await applyOnboardingAnswers();
}

function startOnboarding(force = false) {
  const savedAnswers = loadSavedOnboardingAnswers();
  const alreadyDone = localStorage.getItem(ONBOARDING_KEY) === "1";
  if (alreadyDone && !force) {
    onboardingOverlay.classList.add("hidden");
    onboardingState.answers = savedAnswers || getDefaultOnboardingAnswers();
    applyOnboardingAnswers().catch((err) => appendLog(String(err?.message || err)));
    return;
  }
  onboardingOverlay.classList.remove("hidden");
  onboardingState.stepIndex = 0;
  onboardingState.answers = {
    projectType: savedAnswers?.projectType || null,
    flowMode: savedAnswers?.flowMode || null,
    sizePreset: savedAnswers?.sizePreset || null,
    viewMode: savedAnswers?.viewMode || "3d"
  };
  renderOnboardingStep();
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatMoney(value) {
  const n = Number(value || 0);
  return Number.isFinite(n)
    ? n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "0.00";
}

function extractProjectionPayload(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (Array.isArray(raw.lines)) return raw;
  if (raw.result && typeof raw.result === "object" && Array.isArray(raw.result.lines)) {
    return raw.result;
  }
  return null;
}

function renderFriendlyResult(raw) {
  if (!runResult) return;

  if (typeof raw === "string") {
    runResult.innerHTML = `<div class="result-chip">${escapeHtml(raw)}</div>`;
    hasProjectionResult = false;
    updateGuidedCoach();
    return;
  }

  const projection = extractProjectionPayload(raw);
  if (!projection) {
    runResult.innerHTML = `<div class="result-chip">Resultado recibido.</div>`;
    hasProjectionResult = false;
    updateGuidedCoach();
    return;
  }

  const totals = projection.totals || {};
  const grandTotal = Number(totals.grandTotal || totals.total || 0);
  const materials = Number(totals.materials || totals.materiales || 0);
  const labor = Number(totals.labor || totals.manoObra || totals.mano_obra || 0);
  const lineCount = Array.isArray(projection.lines) ? projection.lines.length : 0;
  const precision = projection.precisionScore || projection.precision || "normal";

  const lineRows = (projection.lines || [])
    .slice(0, 5)
    .map((line) => {
      const name = line.materialName || line.materialId || line.id || "item";
      const qty = Number(line.qtyForCost || line.qty || 0);
      const unit = line.unitForCost || line.unit || "";
      const unitCost = Number(line.costUnit || line.unitCost || 0);
      const subtotal = Number(
        line.lineTotal != null ? line.lineTotal : Number((qty * unitCost).toFixed(2))
      );
      return `
        <div class="result-row">
          <span>${escapeHtml(name)} (${qty.toFixed(2)} ${escapeHtml(unit)})</span>
          <strong>${formatMoney(subtotal)}</strong>
        </div>
      `;
    })
    .join("");

  runResult.innerHTML = [
    `<div class="result-total">Total estimado: ${formatMoney(grandTotal)}</div>`,
    `<div class="result-row"><span>Lineas</span><strong>${lineCount}</strong></div>`,
    `<div class="result-row"><span>Materiales</span><strong>${formatMoney(materials)}</strong></div>`,
    `<div class="result-row"><span>Mano de obra</span><strong>${formatMoney(labor)}</strong></div>`,
    `<div class="result-chip">Precision: ${escapeHtml(precision)}</div>`,
    lineRows ? `<div class="result-section-title">De donde sale el total</div>${lineRows}` : ""
  ].join("");

  hasProjectionResult = true;
  updateGuidedCoach();
}

function updateGuidedCoach() {
  const templateReady = Boolean(getSelectedTemplate());
  const quick = readQuickInputs();
  const measuresReady = quick.pieces > 0 && quick.pieceLength > 0 && quick.pieceWidth > 0;
  const calcReady = hasProjectionResult;
  const reviewReady = hasProjectionResult && previewMode === "3d";

  if (guideStepTemplate) guideStepTemplate.classList.toggle("done", templateReady);
  if (guideStepMeasures) guideStepMeasures.classList.toggle("done", measuresReady);
  if (guideStepCalculate) guideStepCalculate.classList.toggle("done", calcReady);
  if (guideStepReview) guideStepReview.classList.toggle("done", reviewReady);

  if (!guidedCoachText) return;
  if (!templateReady) {
    guidedCoachText.textContent = "Paso actual: elige el tipo de trabajo en la izquierda.";
    return;
  }
  if (!measuresReady) {
    guidedCoachText.textContent = "Paso actual: escribe piezas, largo y ancho para ver tu proyecto.";
    return;
  }
  if (!calcReady) {
    guidedCoachText.textContent = "Paso actual: presiona 'Calcular ahora'.";
    return;
  }
  guidedCoachText.textContent = "Listo. Ya tienes resultado. Revisa la vista 3D o abre Modo Pro.";
}

function appendLog(message) {
  const previous = hostLog.textContent || "";
  const nextLine = `[${nowLabel()}] ${message}`;
  hostLog.textContent = `${nextLine}\n${previous}`.slice(0, 12000);
}

function setBridgeStatus(kind, message) {
  bridgeStatus.classList.remove("status-ok", "status-warn", "status-err");
  if (kind === "ok") bridgeStatus.classList.add("status-ok");
  else if (kind === "err") bridgeStatus.classList.add("status-err");
  else bridgeStatus.classList.add("status-warn");
  bridgeStatus.textContent = message;

  if (autoPrepStatus) {
    autoPrepStatus.classList.remove("status-ok", "status-warn", "status-err");
    if (kind === "ok") autoPrepStatus.classList.add("status-ok");
    else if (kind === "err") autoPrepStatus.classList.add("status-err");
    else autoPrepStatus.classList.add("status-warn");
    autoPrepStatus.textContent = kind === "ok" ? "Listo para calcular" : message;
  }
}

function makeRequestId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function makeEnvelope(type, payload = {}, requestId = makeRequestId()) {
  return {
    app: APP_ID,
    version: APP_VERSION,
    type,
    requestId,
    payload
  };
}

function validateEnvelope(raw) {
  if (!raw || typeof raw !== "object") return { ok: false, reason: "Payload is not an object." };
  if (raw.app !== APP_ID) return { ok: false, reason: "Invalid app id." };
  if (raw.version !== APP_VERSION) return { ok: false, reason: "Invalid version." };
  if (!MESSAGE_TYPES.has(raw.type)) return { ok: false, reason: `Invalid message type '${String(raw.type)}'.` };
  if (typeof raw.requestId !== "string" || raw.requestId.length < 4) {
    return { ok: false, reason: "Invalid requestId." };
  }
  if (!("payload" in raw)) return { ok: false, reason: "Missing payload." };
  if (!raw.payload || typeof raw.payload !== "object" || Array.isArray(raw.payload)) {
    return { ok: false, reason: "Invalid payload type." };
  }
  return { ok: true };
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function postToBuilder(type, payload = {}, requestId = makeRequestId()) {
  if (!iframe.contentWindow) {
    appendLog("postToBuilder skipped: iframe contentWindow unavailable.");
    return null;
  }

  const envelope = makeEnvelope(type, payload, requestId);
  iframe.contentWindow.postMessage(envelope, builderOrigin);
  return envelope;
}

function readTemplates() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeTemplates(templates) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

function upsertTemplate(template) {
  const templates = readTemplates();
  const index = templates.findIndex((entry) => entry.id === template.id);
  if (index === -1) templates.unshift(template);
  else templates[index] = template;
  writeTemplates(templates);
  renderTemplateList();
}

function removeTemplate(templateId) {
  const templates = readTemplates().filter((template) => template.id !== templateId);
  writeTemplates(templates);
  renderTemplateList();
}

function downloadJsonFile(fileName, jsonObject) {
  const blob = new Blob([JSON.stringify(jsonObject, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function renderTemplateList() {
  const templates = readTemplates();
  templateSelect.innerHTML = "";

  if (!templates.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No templates available";
    templateSelect.appendChild(option);
    updateGuidedCoach();
    return;
  }

  templates
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")))
    .forEach((template) => {
      const option = document.createElement("option");
      option.value = template.id;
      option.textContent = `${template.name} (${template.version || "n/a"})`;
      templateSelect.appendChild(option);
    });

  updateGuidedCoach();
}

function getSelectedTemplate() {
  const selectedId = String(templateSelect.value || "");
  if (!selectedId) return null;
  return readTemplates().find((template) => template.id === selectedId) || null;
}

function parseInputsJson() {
  const raw = String(runInputs.value || "{}").trim();
  if (!raw) return {};
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Inputs JSON must be an object.");
  }
  return parsed;
}

function showResult(value) {
  renderFriendlyResult(value);

  if (runResultRaw) {
    runResultRaw.textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  }
  if (runTechnicalDetails) {
    runTechnicalDetails.open = false;
  }
}

function readQuickInputs() {
  return {
    pieces: Math.max(0, Number(quickPieces?.value || 0)),
    pieceLength: Math.max(0, Number(quickLength?.value || 0)),
    pieceWidth: Math.max(0, Number(quickWidth?.value || 0)),
    wastePct: Math.max(0, Number(quickWastePct?.value || 0))
  };
}

async function ensureThreeLibrary() {
  if (threeLibPromise) return threeLibPromise;

  const loadAttempts = async () => {
    const attempts = [
      async () => {
        const [threeModule, controlsModule] = await Promise.all([
          import("../assets/vendor/three/three.module.js"),
          import("../assets/vendor/three/OrbitControls.js")
        ]);
        return { THREE: threeModule, OrbitControls: controlsModule.OrbitControls };
      }
    ];

    let lastError = null;
    for (const attempt of attempts) {
      try {
        return await attempt();
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error("No se pudo cargar el motor 3D.");
  };

  threeLibPromise = loadAttempts()
    .catch((error) => {
      threeLibPromise = null;
      throw error;
    });

  return threeLibPromise;
}

function disposeThreeNode(node) {
  if (!node) return;
  node.traverse((child) => {
    if (child.geometry) {
      child.geometry.dispose();
    }
    if (child.material) {
      if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
      else child.material.dispose();
    }
  });
}

async function getOrCreateThreeViewer(key, container, withControls) {
  if (!container) return null;

  const existing = threeViewers.get(key);
  if (existing) return existing;

  const { THREE, OrbitControls } = await ensureThreeLibrary();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x08142e);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 300);
  camera.position.set(8, 6, 8);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x08142e, 1);

  container.innerHTML = "";
  container.appendChild(renderer.domElement);

  const ambient = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xffffff, 1.1);
  sun.position.set(8, 12, 6);
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0x7dd3fc, 0.4);
  fill.position.set(-6, 7, -8);
  scene.add(fill);

  const grid = new THREE.GridHelper(36, 24, 0x2b5faa, 0x1a3768);
  grid.position.y = -0.001;
  scene.add(grid);

  const lotGroup = new THREE.Group();
  scene.add(lotGroup);

  const controls = withControls ? new OrbitControls(camera, renderer.domElement) : null;
  if (controls) {
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 0, 0);
    controls.update();
  }

  const viewer = {
    THREE,
    scene,
    camera,
    renderer,
    controls,
    lotGroup,
    raf: 0,
    autoSpin: !withControls,
    dispose() {
      cancelAnimationFrame(viewer.raf);
      if (viewer.resizeObserver) viewer.resizeObserver.disconnect();
      disposeThreeNode(viewer.lotGroup);
      if (viewer.sharedGeom) viewer.sharedGeom.dispose();
      if (viewer.sharedMat) viewer.sharedMat.dispose();
      viewer.renderer.dispose();
      if (viewer.renderer.domElement?.parentElement === container) {
        container.removeChild(viewer.renderer.domElement);
      }
    }
  };

  const resize = () => {
    const width = Math.max(200, container.clientWidth || 200);
    const height = Math.max(180, container.clientHeight || 180);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };

  if (typeof ResizeObserver !== "undefined") {
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    viewer.resizeObserver = resizeObserver;
  } else {
    window.addEventListener("resize", resize);
  }

  const renderLoop = () => {
    if (viewer.autoSpin && viewer.lotGroup) {
      viewer.lotGroup.rotation.y += 0.004;
    }
    if (viewer.controls) viewer.controls.update();
    renderer.render(scene, camera);
    viewer.raf = requestAnimationFrame(renderLoop);
  };

  resize();
  renderLoop();
  threeViewers.set(key, viewer);
  return viewer;
}

function updateThreeLot(viewer, data) {
  if (!viewer) return;
  const { pieces, pieceLength, pieceWidth, wastePct } = data;
  const { THREE, lotGroup, camera, controls } = viewer;

  if (viewer.sharedGeom) viewer.sharedGeom.dispose();
  if (viewer.sharedMat) viewer.sharedMat.dispose();

  while (lotGroup.children.length) {
    const child = lotGroup.children.pop();
    lotGroup.remove(child);
  }

  const qty = Math.max(1, Math.min(180, Math.round(pieces || 1)));
  const length = Math.max(0.25, Math.min(4, pieceLength || 1));
  const width = Math.max(0.15, Math.min(2, pieceWidth || 0.5));
  const height = Math.max(0.05, Math.min(0.4, 0.08 + (wastePct || 0) * 0.01));

  const cols = Math.max(1, Math.ceil(Math.sqrt(qty)));
  const rows = Math.max(1, Math.ceil(qty / cols));
  const gapX = length * 1.2;
  const gapZ = width * 1.3;

  const geom = new THREE.BoxGeometry(length, height, width);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x58b6ff,
    roughness: 0.45,
    metalness: 0.08
  });
  viewer.sharedGeom = geom;
  viewer.sharedMat = mat;

  for (let i = 0; i < qty; i += 1) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const x = (col - (cols - 1) / 2) * gapX;
    const z = (row - (rows - 1) / 2) * gapZ;
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(x, height / 2, z);
    lotGroup.add(mesh);
  }

  const span = Math.max(cols * gapX, rows * gapZ);
  camera.position.set(span * 0.9 + 1.5, span * 0.6 + 1.2, span * 0.9 + 1.5);
  if (controls) {
    controls.target.set(0, 0, 0);
    controls.update();
  } else {
    camera.lookAt(0, 0, 0);
  }
}

async function renderThreePreview(container, data, key = "quick", withControls = false) {
  if (!container) return false;
  try {
    const viewer = await getOrCreateThreeViewer(key, container, withControls);
    updateThreeLot(viewer, data);
    return true;
  } catch (error) {
    if (!threeLoadErrorLogged) {
      appendLog(`3D real no disponible. Fallback activo. ${String(error?.message || error)}`);
      threeLoadErrorLogged = true;
    }
    return false;
  }
}

function drawIsoBlock(ctx, x, y, width, depth, height, colors) {
  const topA = { x, y };
  const topB = { x: x + width, y };
  const topC = { x: x + width - depth, y: y - depth };
  const topD = { x: x - depth, y: y - depth };

  const sideA = { x: topA.x, y: topA.y + height };
  const sideB = { x: topB.x, y: topB.y + height };
  const sideC = { x: topC.x, y: topC.y + height };
  const sideD = { x: topD.x, y: topD.y + height };

  ctx.beginPath();
  ctx.moveTo(topA.x, topA.y);
  ctx.lineTo(topB.x, topB.y);
  ctx.lineTo(topC.x, topC.y);
  ctx.lineTo(topD.x, topD.y);
  ctx.closePath();
  ctx.fillStyle = colors.top;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(topA.x, topA.y);
  ctx.lineTo(topD.x, topD.y);
  ctx.lineTo(sideD.x, sideD.y);
  ctx.lineTo(sideA.x, sideA.y);
  ctx.closePath();
  ctx.fillStyle = colors.left;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(topB.x, topB.y);
  ctx.lineTo(topC.x, topC.y);
  ctx.lineTo(sideC.x, sideC.y);
  ctx.lineTo(sideB.x, sideB.y);
  ctx.closePath();
  ctx.fillStyle = colors.right;
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawQuickPreview2D(ctx, data, width, height) {
  const { pieces, pieceLength, pieceWidth } = data;

  ctx.fillStyle = "#8fb4ff";
  ctx.font = "bold 12px Segoe UI";
  ctx.fillText("vista 2d", 12, 20);
  ctx.fillText("lote", 200, 20);

  const px = 14;
  const py = 30;
  const maxW = 150;
  const maxH = 120;
  const drawW = Math.max(10, pieceLength);
  const drawH = Math.max(10, pieceWidth);
  const scale = Math.min(maxW / drawW, maxH / drawH);
  const rw = drawW * scale;
  const rh = drawH * scale;

  ctx.strokeStyle = "#4ea0ff";
  ctx.lineWidth = 2;
  ctx.strokeRect(px, py, rw, rh);
  ctx.fillStyle = "rgba(78, 160, 255, 0.18)";
  ctx.fillRect(px, py, rw, rh);

  ctx.fillStyle = "#cfe0ff";
  ctx.font = "11px Segoe UI";
  ctx.fillText(`L: ${pieceLength.toFixed(2)} m`, px, py + rh + 16);
  ctx.fillText(`A: ${pieceWidth.toFixed(2)} m`, px, py + rh + 30);

  const lotX = 200;
  const lotY = 30;
  const lotW = 146;
  const lotH = 150;
  ctx.strokeStyle = "rgba(147, 181, 255, 0.35)";
  ctx.lineWidth = 1;
  ctx.strokeRect(lotX, lotY, lotW, lotH);

  const maxDots = Math.min(120, Math.round(pieces));
  const cols = Math.max(1, Math.ceil(Math.sqrt(maxDots || 1)));
  const rows = Math.max(1, Math.ceil(maxDots / cols));
  const cellW = lotW / cols;
  const cellH = lotH / rows;
  const dotR = Math.max(2, Math.min(6, Math.min(cellW, cellH) * 0.3));

  ctx.fillStyle = "#6ec1ff";
  for (let i = 0; i < maxDots; i += 1) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = lotX + col * cellW + cellW / 2;
    const cy = lotY + row * cellH + cellH / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, dotR, 0, Math.PI * 2);
    ctx.fill();
  }

  if (pieces > maxDots) {
    ctx.fillStyle = "#cfe0ff";
    ctx.font = "11px Segoe UI";
    ctx.fillText(`+${Math.round(pieces - maxDots)} piezas`, lotX + 8, lotY + lotH - 8);
  }

  ctx.strokeStyle = "rgba(147, 181, 255, 0.2)";
  ctx.strokeRect(6, 6, width - 12, height - 12);
}

function drawQuickPreview3D(ctx, data, width, height) {
  const { pieces, pieceLength, pieceWidth, wastePct } = data;

  ctx.fillStyle = "#8fb4ff";
  ctx.font = "bold 12px Segoe UI";
  ctx.fillText("pieza 3d", 12, 20);
  ctx.fillText("lote 3d", 205, 20);

  const blockWidth = Math.max(46, Math.min(120, pieceLength * 36));
  const blockDepth = Math.max(14, Math.min(40, pieceWidth * 44));
  const blockHeight = Math.max(18, Math.min(52, 20 + wastePct * 1.5));
  const originX = 78;
  const originY = 64;

  drawIsoBlock(ctx, originX, originY, blockWidth, blockDepth, blockHeight, {
    top: "rgba(110, 193, 255, 0.72)",
    left: "rgba(46, 123, 213, 0.9)",
    right: "rgba(31, 91, 173, 0.95)"
  });

  ctx.fillStyle = "#d6e7ff";
  ctx.font = "11px Segoe UI";
  ctx.fillText(`L ${pieceLength.toFixed(2)} m`, 14, 174);
  ctx.fillText(`A ${pieceWidth.toFixed(2)} m`, 14, 190);
  ctx.fillText(`Merma ${wastePct.toFixed(1)}%`, 14, 206);

  const miniCount = Math.max(1, Math.min(20, Math.round(pieces)));
  const cols = Math.max(1, Math.min(5, Math.ceil(Math.sqrt(miniCount))));
  const miniWidth = 22;
  const miniDepth = 9;
  const miniHeight = 12;
  const startX = 212;
  const startY = 52;

  for (let i = 0; i < miniCount; i += 1) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = startX + col * 27;
    const y = startY + row * 24;
    drawIsoBlock(ctx, x, y, miniWidth, miniDepth, miniHeight, {
      top: "rgba(125, 211, 252, 0.78)",
      left: "rgba(59, 130, 246, 0.82)",
      right: "rgba(37, 99, 235, 0.9)"
    });
  }

  if (pieces > miniCount) {
    ctx.fillStyle = "#cfe0ff";
    ctx.font = "11px Segoe UI";
    ctx.fillText(`+${Math.round(pieces - miniCount)} piezas`, 214, 196);
  }

  ctx.strokeStyle = "rgba(147, 181, 255, 0.2)";
  ctx.strokeRect(6, 6, width - 12, height - 12);
}

function drawQuickPreview() {
  if (!quickCanvas || !quickSummary) return;
  const ctx = quickCanvas.getContext("2d");
  if (!ctx) return;

  const data = readQuickInputs();
  const { pieces, pieceLength, pieceWidth, wastePct } = data;
  const width = quickCanvas.width;
  const height = quickCanvas.height;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#08142e";
  ctx.fillRect(0, 0, width, height);

  if (previewMode === "2d") {
    if (quick3dViewport) quick3dViewport.classList.add("hidden");
    quickCanvas.classList.remove("hidden");
    drawQuickPreview2D(ctx, data, width, height);
  } else {
    drawQuickPreview3D(ctx, data, width, height); // fallback while real 3D loads
    quickCanvas.classList.remove("hidden");
    if (quick3dViewport) {
      renderThreePreview(quick3dViewport, data, "quick", false).then((ok) => {
        if (ok) {
          quick3dViewport.classList.remove("hidden");
          quickCanvas.classList.add("hidden");
        } else {
          quick3dViewport.classList.add("hidden");
          quickCanvas.classList.remove("hidden");
        }
      });
    }
  }

  const pieceArea = pieceLength * pieceWidth;
  const totalArea = pieceArea * pieces;
  const totalWithWaste = totalArea * (1 + wastePct / 100);

  quickSummary.textContent =
    `${previewMode === "3d" ? "Vista 3D" : "Vista 2D"} | ` +
    `${pieces.toFixed(0)} piezas de ${pieceLength.toFixed(2)} m x ${pieceWidth.toFixed(2)} m | ` +
    `Area neta ${totalArea.toFixed(2)} m2 | Area con merma ${totalWithWaste.toFixed(2)} m2`;

  updateGuidedCoach();
}

function syncQuickInputsFromForm() {
  if (!quickPieces || !quickLength || !quickWidth || !quickWastePct || !runInputs) {
    return;
  }

  const pieces = Number(quickPieces.value || 0);
  const pieceLength = Number(quickLength.value || 0);
  const pieceWidth = Number(quickWidth.value || 0);
  const wastePct = Number(quickWastePct.value || 0);

  const nextInputs = {
    pieces,
    pieceLength,
    pieceWidth,
    wastePct,
    length: pieceLength,
    width: pieceWidth
  };

  runInputs.value = JSON.stringify(nextInputs, null, 2);
  drawQuickPreview();
}

async function loadDemoTemplates() {
  const loaded = [];
  for (const path of DEMO_TEMPLATE_PATHS) {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Failed to fetch demo template: ${path}`);
    }
    const template = await response.json();
    loaded.push(template);
  }

  loaded.forEach((template) => upsertTemplate(template));
  appendLog(`Se cargaron ${loaded.length} plantillas demo.`);
}

function sendInit() {
  const initialTemplate = getSelectedTemplate();
  const requestId = makeRequestId();
  pendingRequests.set(requestId, "INIT");
  postToBuilder(
    "INIT",
    {
      mode: "builder",
      initialTemplate,
      settings: {
        defaultUnits: ["mm", "cm", "m", "in", "ft"],
        locale: "es-GT",
        precisionMode: "strict"
      }
    },
    requestId
  );
  appendLog("INIT enviado al constructor.");
}

window.addEventListener("message", async (event) => {
  if (!allowedBuilderOrigins.has(event.origin)) {
    return;
  }

  if (event.source !== iframe.contentWindow) {
    appendLog("Ignored message: source mismatch.");
    return;
  }

  const validation = validateEnvelope(event.data);
  if (!validation.ok) {
    appendLog(`Ignored malformed envelope: ${validation.reason}`);
    return;
  }

  const message = event.data;
  const requestLabel = pendingRequests.get(message.requestId);

  switch (message.type) {
    case "READY": {
      builderReady = true;
      setBridgeStatus("ok", "Constructor conectado");
      appendLog(`READY recibido desde el constructor (${event.origin}).`);
      sendInit();
      break;
    }

    case "SAVE_TEMPLATE": {
      const template = isPlainObject(message.payload) ? message.payload.template : null;
      if (!isPlainObject(template)) {
        postToBuilder("ERROR", { message: "SAVE_TEMPLATE payload.template must be an object." }, message.requestId);
        appendLog("SAVE_TEMPLATE rechazado por payload invalido.");
        return;
      }
      const check = validateTemplateSafe(template);
      if (!check.ok) {
        postToBuilder("ERROR", {
          message: "Template validation failed in host.",
          errors: check.errors
        }, message.requestId);
        appendLog("SAVE_TEMPLATE rechazado por esquema invalido.");
        return;
      }

      upsertTemplate(template);
      postToBuilder("RESULT", { status: "saved", templateId: template.id }, message.requestId);
      appendLog(`Plantilla guardada desde constructor: ${template.id}`);
      break;
    }

    case "EXPORT_TEMPLATE": {
      const template = isPlainObject(message.payload) ? message.payload.template : null;
      if (!isPlainObject(template)) {
        postToBuilder("ERROR", { message: "EXPORT_TEMPLATE payload.template must be an object." }, message.requestId);
        appendLog("EXPORT_TEMPLATE rechazado por payload invalido.");
        return;
      }
      const check = validateTemplateSafe(template);
      if (!check.ok) {
        postToBuilder("ERROR", {
          message: "Template cannot be exported because schema is invalid.",
          errors: check.errors
        }, message.requestId);
        return;
      }

      const fileName = `${template.name || "template"}-${template.version || "v1"}.json`;
      downloadJsonFile(fileName.replace(/\s+/g, "-"), template);
      postToBuilder("RESULT", { status: "exported", fileName }, message.requestId);
      appendLog(`Plantilla exportada: ${fileName}`);
      break;
    }

    case "RUN": {
      const payload = isPlainObject(message.payload) ? message.payload : null;
      const template = payload?.template;
      const inputs = payload?.inputs ?? {};
      if (!isPlainObject(template)) {
        postToBuilder("ERROR", { message: "RUN payload.template must be an object." }, message.requestId);
        appendLog("RUN rechazado por plantilla invalida.");
        return;
      }
      if (!isPlainObject(inputs)) {
        postToBuilder("ERROR", { message: "RUN payload.inputs must be an object." }, message.requestId);
        appendLog("RUN rechazado por inputs invalidos.");
        return;
      }
      const outcome = runProjectionSafe(template, inputs);
      if (!outcome.ok) {
        postToBuilder("ERROR", { message: outcome.error, validation: outcome.validation }, message.requestId);
      } else {
        postToBuilder("RESULT", outcome.result, message.requestId);
      }
      appendLog(`RUN ejecutado en host para request ${message.requestId}.`);
      break;
    }

    case "RESULT": {
      if (requestLabel) pendingRequests.delete(message.requestId);
      appendLog(`RESULT recibido para ${requestLabel || "unknown request"}.`);
      showResult(message.payload);
      break;
    }

    case "ERROR": {
      if (requestLabel) pendingRequests.delete(message.requestId);
      setBridgeStatus("err", "El constructor reporto error");
      appendLog(`ERROR from builder: ${String(message.payload?.message || "Unknown")}`);
      showResult(message.payload || { message: "Unknown error" });
      break;
    }

    case "PING": {
      postToBuilder("PONG", { now: nowLabel() }, message.requestId);
      break;
    }

    case "PONG": {
      appendLog("PONG recibido.");
      break;
    }

    default:
      appendLog(`Unhandled message type: ${message.type}`);
      break;
  }
});

pingBtn.addEventListener("click", () => {
  if (!builderReady) {
    setBridgeStatus("warn", "El constructor aun no esta listo");
    return;
  }
  const requestId = makeRequestId();
  pendingRequests.set(requestId, "PING");
  postToBuilder("PING", { from: "host" }, requestId);
});

openBuilderTabBtn.addEventListener("click", () => {
  if (currentFlowMode === "guiado") {
    onboardingState.answers.flowMode = "pro";
    saveOnboardingAnswers();
    setFlowMode("pro");
    if (heroSubtitle) {
      heroSubtitle.textContent = "Constructor avanzado visible. Puedes volver a modo guiado cuando quieras.";
    }
    if (iframeWrap) iframeWrap.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  openStandaloneBuilderTab();
});

if (guidedOpenBuilderBtn) {
  guidedOpenBuilderBtn.addEventListener("click", () => {
    onboardingState.answers.flowMode = "pro";
    saveOnboardingAnswers();
    setFlowMode("pro");
    if (heroSubtitle) {
      heroSubtitle.textContent = "Constructor avanzado visible. Puedes volver a modo guiado cuando quieras.";
    }
    if (iframeWrap) iframeWrap.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

if (open3dProBtn) {
  open3dProBtn.addEventListener("click", () => {
    open3DProModal();
  });
}

if (guidedOpen3dProBtn) {
  guidedOpen3dProBtn.addEventListener("click", () => {
    open3DProModal();
  });
}

if (close3dProBtn) {
  close3dProBtn.addEventListener("click", () => {
    close3DProModal();
  });
}

if (threeProModal) {
  threeProModal.addEventListener("click", (event) => {
    if (event.target === threeProModal) {
      close3DProModal();
    }
  });
}

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    close3DProModal();
  }
});

if (onboardingBackBtn) {
  onboardingBackBtn.addEventListener("click", () => {
    if (onboardingState.stepIndex <= 0) return;
    onboardingState.stepIndex -= 1;
    renderOnboardingStep();
  });
}

if (onboardingSkipBtn) {
  onboardingSkipBtn.addEventListener("click", () => {
    finishOnboarding(true).catch((error) => appendLog(String(error?.message || error)));
  });
}

if (onboardingNextBtn) {
  onboardingNextBtn.addEventListener("click", () => {
    const step = onboardingSteps[onboardingState.stepIndex];
    if (!step) return;
    if (!onboardingState.answers[step.key]) return;

    if (onboardingState.stepIndex >= onboardingSteps.length - 1) {
      finishOnboarding(true).catch((error) => appendLog(String(error?.message || error)));
      return;
    }

    onboardingState.stepIndex += 1;
    renderOnboardingStep();
  });
}

if (restartTutorBtn) {
  restartTutorBtn.addEventListener("click", () => {
    startOnboarding(true);
  });
}

loadDemosBtn.addEventListener("click", async () => {
  try {
    await loadDemoTemplates();
    setBridgeStatus("ok", "Plantillas demo cargadas");
  } catch (error) {
    setBridgeStatus("err", "Fallo la carga de demos");
    appendLog(String(error?.message || error));
  }
});

refreshTemplatesBtn.addEventListener("click", renderTemplateList);

sendTemplateBtn.addEventListener("click", () => {
  const template = getSelectedTemplate();
  if (!template) {
    appendLog("No hay plantilla seleccionada.");
    return;
  }

  if (!builderReady) {
    appendLog("El constructor todavia no esta listo.");
    return;
  }

  const requestId = makeRequestId();
  pendingRequests.set(requestId, "LOAD_TEMPLATE");
  postToBuilder("LOAD_TEMPLATE", { template }, requestId);
  appendLog(`LOAD_TEMPLATE enviado: ${template.id}`);
});

deleteTemplateBtn.addEventListener("click", () => {
  const template = getSelectedTemplate();
  if (!template) return;
  const confirmed = window.confirm(`Eliminar la plantilla '${template.name}'?`);
  if (!confirmed) return;
  removeTemplate(template.id);
  appendLog(`Plantilla eliminada: ${template.id}`);
});

importTemplateInput.addEventListener("change", async () => {
  const file = importTemplateInput.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const template = JSON.parse(text);
    const check = validateTemplateSafe(template);
    if (!check.ok) {
      throw new Error(`Invalid template JSON: ${check.errors.join(" | ")}`);
    }
    upsertTemplate(template);
    appendLog(`Plantilla importada: ${template.id}`);
  } catch (error) {
    appendLog(`Importacion fallida: ${String(error?.message || error)}`);
  } finally {
    importTemplateInput.value = "";
  }
});

runInBuilderBtn.addEventListener("click", () => {
  const template = getSelectedTemplate();
  if (!template) {
    showResult("Selecciona una plantilla antes de ejecutar.");
    return;
  }

  syncQuickInputsFromForm();

  let inputs;
  try {
    inputs = parseInputsJson();
  } catch (error) {
    showResult(String(error?.message || error));
    return;
  }

  if (!builderReady) {
    const outcome = runProjectionSafe(template, inputs);
    if (outcome.ok) {
      showResult(outcome.result);
      appendLog(`RUN ejecutado localmente (fallback) para plantilla ${template.id}.`);
    } else {
      showResult(outcome.error || "No se pudo calcular localmente.");
    }
    return;
  }

  const requestId = makeRequestId();
  pendingRequests.set(requestId, "RUN");
  showResult("Calculando...");
  postToBuilder("RUN", { template, inputs }, requestId);
  appendLog(`RUN enviado al constructor para plantilla ${template.id}.`);
});

runInHostBtn.addEventListener("click", () => {
  const template = getSelectedTemplate();
  if (!template) {
    showResult("Selecciona una plantilla antes de ejecutar.");
    return;
  }

  syncQuickInputsFromForm();

  try {
    const inputs = parseInputsJson();
    const outcome = runProjectionSafe(template, inputs);
    showResult(outcome);
    appendLog(`RUN ejecutado localmente para plantilla ${template.id}.`);
  } catch (error) {
    showResult(String(error?.message || error));
  }
});

if (quickPieces) quickPieces.addEventListener("input", syncQuickInputsFromForm);
if (quickLength) quickLength.addEventListener("input", syncQuickInputsFromForm);
if (quickWidth) quickWidth.addEventListener("input", syncQuickInputsFromForm);
if (quickWastePct) quickWastePct.addEventListener("input", syncQuickInputsFromForm);
if (templateSelect) templateSelect.addEventListener("change", updateGuidedCoach);

migrateTemplatesIfNeeded();
renderTemplateList();
appendLog(`Host inicializado. URL iframe constructor: ${iframe.src}`);
setBridgeStatus("warn", "Conectando con el constructor...");
syncQuickInputsFromForm();
setFlowMode("guiado");
startOnboarding(false);
updateGuidedCoach();

