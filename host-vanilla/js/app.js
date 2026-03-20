import { templateStore } from './core/templateStore.js';
import { calculator } from './core/calculator.js';
import { unitSystem } from './core/unitSystem.js';
import { stepper } from './ui/stepper.js';
import { renderInputs } from './ui/renderInputs.js';
import { createResultsRenderer } from './ui/renderResults.js';
import { createAdvancedBuilder } from './ui/advancedBuilder.js';

/*
Template JSON schema (v1)
{
  templateId: string,
  name: string,
  version: string,
  currency: string,
  description?: string,
  inputs: [
    {
      id: string,
      label: string,
      type: "number" | "select" | "text",
      unit?: string,
      unitOptions?: string[],
      default?: number | string,
      required?: boolean,
      min?: number,
      max?: number,
      step?: number,
      help?: string,
      options?: Array<string | { value: string, label: string }>
    }
  ],
  derived: [
    {
      id: string,
      formula: string,
      unit?: string,
      precision?: number
    }
  ],
  materials: [
    {
      id: string,
      name: string,
      qtyFormula: string,
      unit: string,
      wastePct?: number | string,
      unitCostInputId?: string,
      defaultUnitCost?: number,
      rounding?: "ceil" | "round" | "none" | "floor",
      precision?: number
    }
  ],
  summary: {
    includeLabor?: boolean,
    laborInputId?: string,
    defaultLabor?: number,
    includeFixedCost?: boolean,
    fixedCostInputId?: string,
    defaultFixedCost?: number,
    includeTax?: boolean,
    taxPctInputId?: string,
    defaultTaxPct?: number,
    costPerInputId?: string,
    costPerDerivedId?: string
  },
  "3d": {
    enabled: boolean,
    dims: { xId: string, yId: string, zId: string },
    labels?: { x?: string, y?: string, z?: string }
  }
}
*/

const refs = {
  stepper: document.getElementById('stepperTrack'),
  connectionChip: document.getElementById('connectionChip'),
  connectionText: document.getElementById('connectionText'),
  templateSelect: document.getElementById('templateSelect'),
  templateMeta: document.getElementById('templateMeta'),
  inputsContainer: document.getElementById('inputsContainer'),
  inputErrors: document.getElementById('inputErrors'),
  resultErrors: document.getElementById('resultErrors'),
  resultTitle: document.getElementById('resultTitle'),
  totalValue: document.getElementById('totalValue'),
  breakdown: document.getElementById('breakdownGrid'),
  materialTableBody: document.getElementById('materialsBody'),
  technical: document.getElementById('technicalContent'),
  mini3dCanvas: document.getElementById('mini3dCanvas'),
  pro3dCanvas: document.getElementById('pro3dCanvas'),
  pro3dModal: document.getElementById('pro3dModal'),
  projectBadge: document.getElementById('projectBadge')
};

const ui = {
  btnPrepare: document.getElementById('btnPrepare'),
  btnCalculate: document.getElementById('btnCalculate'),
  btnDemo: document.getElementById('btnDemo'),
  btnResetInputs: document.getElementById('btnResetInputs'),
  btnOpenPro3D: document.getElementById('btnOpenPro3D'),
  btnClosePro3D: document.getElementById('btnClosePro3D'),
  btnNewTemplate: document.getElementById('btnNewTemplate'),
  btnEditTemplate: document.getElementById('btnEditTemplate'),
  btnDuplicateTemplate: document.getElementById('btnDuplicateTemplate'),
  btnDeleteTemplate: document.getElementById('btnDeleteTemplate'),
  btnExportTemplate: document.getElementById('btnExportTemplate'),
  fileImportTemplate: document.getElementById('fileImportTemplate'),
  btnSaveProject: document.getElementById('btnSaveProject'),
  btnExportProject: document.getElementById('btnExportProject'),
  fileImportProject: document.getElementById('fileImportProject'),
  btnGeneratePdf: document.getElementById('btnGeneratePdf'),
  btnReloadDefaults: document.getElementById('btnReloadDefaults'),
  technicalToggle: document.getElementById('technicalToggle')
};

const state = {
  templates: [],
  selectedTemplate: null,
  inputState: {},
  connectionStatus: 'connecting',
  connectionReady: false,
  lastResult: null,
  currentProjectId: null,
  lastValidationErrors: []
};

const resultsRenderer = createResultsRenderer({
  errorList: refs.resultErrors,
  totalValue: refs.totalValue,
  materialTableBody: refs.materialTableBody,
  breakdown: refs.breakdown,
  technical: refs.technical,
  mini3dCanvas: refs.mini3dCanvas,
  pro3dCanvas: refs.pro3dCanvas,
  pro3dModal: refs.pro3dModal
});

const builder = createAdvancedBuilder({
  onSave: async (template) => {
    templateStore.saveTemplate(template);
    await refreshTemplates(template.templateId);
  }
});

function renderTextList(listNode, items) {
  if (!listNode) return;
  listNode.replaceChildren();
  (items || []).forEach((item) => {
    const li = document.createElement('li');
    li.textContent = String(item ?? '');
    listNode.appendChild(li);
  });
}

function setConnectionStatus(status, message) {
  state.connectionStatus = status;
  state.connectionReady = status === 'ready';

  refs.connectionChip.classList.remove('status-ok', 'status-warn', 'status-err');
  if (status === 'ready') refs.connectionChip.classList.add('status-ok');
  else if (status === 'error') refs.connectionChip.classList.add('status-err');
  else refs.connectionChip.classList.add('status-warn');

  refs.connectionChip.textContent = message;
  refs.connectionText.textContent = message;

  updateStepper();
}

function simulatePrepareConnection(force = false) {
  if (!force && state.connectionReady) return;

  setConnectionStatus('connecting', 'Conectando con el constructor...');
  const delay = 650 + Math.floor(Math.random() * 500);

  window.setTimeout(() => {
    setConnectionStatus('ready', 'Listo para calcular');
  }, delay);
}

function getLightInputValidation() {
  if (!state.selectedTemplate) {
    return { errors: ['Selecciona una plantilla primero.'] };
  }
  return calculator.normalizeInputs(state.selectedTemplate, state.inputState);
}

function updateStepper() {
  const validation = getLightInputValidation();
  state.lastValidationErrors = validation.errors || [];

  const steps = stepper.buildStepState({
    hasTemplate: Boolean(state.selectedTemplate),
    connectionReady: state.connectionReady,
    inputsValid: validation.errors.length === 0,
    hasResult: Boolean(state.lastResult?.ok)
  });

  stepper.renderStepper(refs.stepper, steps);
}

function renderTemplateSelect() {
  refs.templateSelect.innerHTML = '';

  state.templates.forEach((template) => {
    const option = document.createElement('option');
    option.value = template.templateId;
    option.textContent = `${template.name} (v${template.version || '1.0.0'})`;
    refs.templateSelect.appendChild(option);
  });

  if (!state.templates.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'No hay plantillas';
    refs.templateSelect.appendChild(option);
  }

  if (state.selectedTemplate) {
    refs.templateSelect.value = state.selectedTemplate.templateId;
  }
}

function renderTemplateMeta() {
  if (!state.selectedTemplate) {
    refs.templateMeta.textContent = 'Selecciona o crea una plantilla para iniciar.';
    refs.resultTitle.textContent = 'Resultados';
    return;
  }

  refs.templateMeta.textContent = `${state.selectedTemplate.description || 'Plantilla universal lista para configurar.'}`;
  refs.resultTitle.textContent = `Resultado - ${state.selectedTemplate.name}`;
}

function renderInputPanel() {
  if (!state.selectedTemplate) {
    refs.inputsContainer.innerHTML = '<p class="muted">No hay plantilla seleccionada.</p>';
    renderTextList(refs.inputErrors, []);
    return;
  }

  renderInputs({
    container: refs.inputsContainer,
    template: state.selectedTemplate,
    inputState: state.inputState,
    onChange: () => {
      const validation = getLightInputValidation();
      renderTextList(refs.inputErrors, validation.errors);
      updateStepper();
    }
  });

  const validation = getLightInputValidation();
  renderTextList(refs.inputErrors, validation.errors);
}

function setSelectedTemplate(templateId, preserveInputState = false) {
  const selected = state.templates.find((template) => template.templateId === templateId) || null;
  state.selectedTemplate = selected;

  if (!selected) {
    state.inputState = {};
    state.lastResult = null;
    state.currentProjectId = null;
    refs.projectBadge.textContent = 'Sin proyecto';
    renderTemplateSelect();
    renderTemplateMeta();
    renderInputPanel();
    resultsRenderer.clear({ currency: 'Q' });
    updateStepper();
    return;
  }

  if (!preserveInputState) {
    state.inputState = calculator.buildDefaultInputState(selected);
  }

  state.lastResult = null;
  renderTemplateSelect();
  renderTemplateMeta();
  renderInputPanel();
  resultsRenderer.clear(selected);
  updateStepper();
}

async function refreshTemplates(preferredId = null) {
  state.templates = templateStore.getTemplates();

  if (!state.templates.length) {
    setSelectedTemplate(null);
    return;
  }

  const nextId = preferredId
    || state.selectedTemplate?.templateId
    || state.templates[0].templateId;

  setSelectedTemplate(nextId);
}

function performCalculation() {
  if (!state.selectedTemplate) return;

  const result = calculator.calculate(state.selectedTemplate, state.inputState);
  state.lastResult = result;

  if (result.ok) {
    refs.projectBadge.textContent = 'Proyecto calculado';
  }

  resultsRenderer.render(result, state.selectedTemplate);
  updateStepper();
}

function saveProject() {
  if (!state.selectedTemplate) return;
  const result = state.lastResult || calculator.calculate(state.selectedTemplate, state.inputState);

  const payload = {
    projectId: state.currentProjectId || undefined,
    templateId: state.selectedTemplate.templateId,
    templateVersion: state.selectedTemplate.version,
    templateSnapshot: state.selectedTemplate,
    name: `${state.selectedTemplate.name} - ${new Date().toLocaleString('es-GT')}`,
    inputState: state.inputState,
    result
  };

  const saved = templateStore.saveProject(payload);
  state.currentProjectId = saved.projectId;
  refs.projectBadge.textContent = `Proyecto guardado: ${saved.projectId}`;
}

function exportCurrentTemplate() {
  if (!state.selectedTemplate) return;
  const content = templateStore.exportTemplateAsJson(state.selectedTemplate.templateId);
  const filename = `${state.selectedTemplate.templateId}.json`;
  templateStore.toBlobDownload(filename, content);
}

function exportCurrentProject() {
  if (!state.selectedTemplate) return;
  if (!state.currentProjectId) {
    saveProject();
  }

  const content = templateStore.exportProjectAsJson(state.currentProjectId);
  const filename = `${state.currentProjectId}.json`;
  templateStore.toBlobDownload(filename, content);
}

async function importTemplateFile(file) {
  if (!file) return;
  const content = await file.text();
  templateStore.importTemplatesFromJson(content);
  await refreshTemplates();
}

async function importProjectFile(file) {
  if (!file) return;
  const content = await file.text();
  const project = templateStore.importProjectFromJson(content);

  const existingTemplate = templateStore.getTemplateById(project.templateId);
  if (!existingTemplate && project.templateSnapshot) {
    templateStore.saveTemplate(project.templateSnapshot);
  }

  await refreshTemplates(project.templateId);
  state.currentProjectId = project.projectId;
  state.inputState = project.inputState || calculator.buildDefaultInputState(state.selectedTemplate);
  renderInputPanel();

  const result = calculator.calculate(state.selectedTemplate, state.inputState);
  state.lastResult = result;
  resultsRenderer.render(result, state.selectedTemplate);

  refs.projectBadge.textContent = `Proyecto cargado: ${project.projectId}`;
  updateStepper();
}

function resetInputs() {
  if (!state.selectedTemplate) return;
  state.inputState = calculator.buildDefaultInputState(state.selectedTemplate);
  state.lastResult = null;
  renderInputPanel();
  resultsRenderer.clear(state.selectedTemplate);
  updateStepper();
}

function applyDemo() {
  if (!state.selectedTemplate) return;
  state.inputState = calculator.applyDemoValues(state.selectedTemplate, state.inputState);
  renderInputPanel();
  performCalculation();
}

function bindEvents() {
  refs.templateSelect.addEventListener('change', (event) => {
    setSelectedTemplate(event.target.value);
  });

  ui.btnPrepare.addEventListener('click', () => simulatePrepareConnection(true));
  ui.btnCalculate.addEventListener('click', performCalculation);
  ui.btnDemo.addEventListener('click', applyDemo);
  ui.btnResetInputs.addEventListener('click', resetInputs);

  ui.btnOpenPro3D.addEventListener('click', () => resultsRenderer.openPro3D());
  ui.btnClosePro3D.addEventListener('click', () => resultsRenderer.closePro3D());

  refs.pro3dModal.addEventListener('click', (event) => {
    if (event.target === refs.pro3dModal) {
      resultsRenderer.closePro3D();
    }
  });

  ui.btnNewTemplate.addEventListener('click', () => {
    const base = {
      templateId: `tpl-${Date.now()}`,
      name: 'Plantilla universal',
      version: '1.0.0',
      currency: 'Q',
      description: 'Plantilla universal creada con asistente guiado.',
      inputs: [],
      derived: [],
      materials: [],
      summary: {
        includeLabor: false,
        includeFixedCost: false,
        includeTax: false
      },
      '3d': {
        enabled: true,
        dims: { xId: '', yId: '', zId: '' }
      }
    };
    builder.open(base, { mode: 'assistant', forceAssistant: true });
  });

  ui.btnEditTemplate.addEventListener('click', () => {
    if (!state.selectedTemplate) return;
    builder.open(state.selectedTemplate, { mode: 'assistant' });
  });

  ui.btnDuplicateTemplate.addEventListener('click', async () => {
    if (!state.selectedTemplate) return;
    const duplicated = templateStore.duplicateTemplate(state.selectedTemplate.templateId);
    await refreshTemplates(duplicated.templateId);
  });

  ui.btnDeleteTemplate.addEventListener('click', async () => {
    if (!state.selectedTemplate) return;
    const confirmed = window.confirm(`Eliminar plantilla '${state.selectedTemplate.name}'?`);
    if (!confirmed) return;
    templateStore.deleteTemplate(state.selectedTemplate.templateId);
    await refreshTemplates();
  });

  ui.btnExportTemplate.addEventListener('click', exportCurrentTemplate);

  ui.fileImportTemplate.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await importTemplateFile(file);
    event.target.value = '';
  });

  ui.btnSaveProject.addEventListener('click', saveProject);
  ui.btnExportProject.addEventListener('click', exportCurrentProject);

  ui.fileImportProject.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await importProjectFile(file);
    event.target.value = '';
  });

  ui.btnGeneratePdf.addEventListener('click', () => {
    window.alert('Generacion PDF: proximamente. El contenido ya esta listo en resultados.');
  });

  ui.btnReloadDefaults.addEventListener('click', async () => {
    await templateStore.initTemplates();
    await refreshTemplates();
    simulatePrepareConnection(true);
  });

  ui.technicalToggle.addEventListener('toggle', () => {
    // reservado para analytics o telemetria futura
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      resultsRenderer.closePro3D();
    }
  });
}

async function loadLastProjectIfAvailable() {
  const project = templateStore.getLastProject();
  if (!project || !project.templateId) return;

  if (!templateStore.getTemplateById(project.templateId) && project.templateSnapshot) {
    templateStore.saveTemplate(project.templateSnapshot);
    state.templates = templateStore.getTemplates();
  }

  if (!state.templates.find((tpl) => tpl.templateId === project.templateId)) {
    return;
  }

  setSelectedTemplate(project.templateId, true);
  state.inputState = project.inputState || calculator.buildDefaultInputState(state.selectedTemplate);
  state.currentProjectId = project.projectId || null;
  renderInputPanel();

  const result = calculator.calculate(state.selectedTemplate, state.inputState);
  state.lastResult = result;
  resultsRenderer.render(result, state.selectedTemplate);
  refs.projectBadge.textContent = project.projectId ? `Ultimo proyecto: ${project.projectId}` : 'Proyecto recuperado';
  updateStepper();
}

async function bootstrap() {
  bindEvents();

  setConnectionStatus('connecting', 'Conectando con el constructor...');

  try {
    await templateStore.initTemplates();
    await refreshTemplates();
    await loadLastProjectIfAvailable();
  } catch (error) {
    renderTextList(refs.resultErrors, [String(error.message || error)]);
  }

  simulatePrepareConnection(true);
}

bootstrap();




