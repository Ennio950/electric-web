import { calculator } from '../core/calculator.js';
import { unitSystem } from '../core/unitSystem.js';

function deepClone(data) {
  return JSON.parse(JSON.stringify(data));
}

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
}

function sanitizeId(value, fallback = 'item') {
  const normalized = String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || fallback;
}

function ensureTemplateShape(template) {
  const normalized = calculator.normalizeTemplate(template);
  normalized.inputs = Array.isArray(normalized.inputs) ? normalized.inputs : [];
  normalized.derived = Array.isArray(normalized.derived) ? normalized.derived : [];
  normalized.materials = Array.isArray(normalized.materials) ? normalized.materials : [];
  normalized.summary = normalized.summary || {};
  normalized['3d'] = normalized['3d'] || { enabled: true, dims: {} };
  if (!normalized['3d'].dims) normalized['3d'].dims = {};
  return normalized;
}

function parseMaybeNumber(value) {
  if (value === '' || value == null) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function parseBoolean(value) {
  return String(value) === 'true';
}

function toPositiveNumber(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed < 0 ? 0 : parsed;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function defaultPrecision(unit) {
  return unitSystem.suggestPrecisionByUnit(unit || '');
}

const EXPERT_TABS = [
  { id: 'meta', label: 'General' },
  { id: 'inputs', label: 'Preguntas' },
  { id: 'derived', label: 'Reglas' },
  { id: 'materials', label: 'Materiales' },
  { id: 'summary', label: 'Totales' },
  { id: 'model3d', label: 'Vista 3D' },
  { id: 'raw', label: 'JSON' }
];

const ASSISTANT_BASE_DERIVED_ID = 'medidaTotal';

const ASSISTANT_PRESETS = {
  area: {
    id: 'area',
    title: 'Superficie (m2)',
    description: 'Para paredes, pisos, techos y paneles.',
    unitLabel: 'm2',
    baseMeasureLabel: 'area total',
    inputs: [
      { id: 'cantidad', label: 'Cuantas areas iguales', type: 'number', unit: 'pza', default: 1, required: true, min: 1, step: 1 },
      { id: 'largo', label: 'Largo', type: 'number', unit: 'm', unitOptions: ['m', 'cm', 'ft'], default: 4, required: true, min: 0.1, step: 0.01 },
      { id: 'ancho', label: 'Ancho', type: 'number', unit: 'm', unitOptions: ['m', 'cm', 'ft'], default: 3, required: true, min: 0.1, step: 0.01 },
      { id: 'margenPct', label: 'Margen extra (%)', type: 'number', unit: '%', default: 8, required: false, min: 0, max: 80, step: 0.1 },
      { id: 'altoVisual', label: 'Alto para vista 3D', type: 'number', unit: 'm', default: 0.2, required: false, min: 0.01, max: 5, step: 0.01, help: 'Solo para visualizacion.' }
    ],
    derived: [
      { id: 'medidaBase', formula: 'largo * ancho', unit: 'm2', precision: 3 },
      { id: 'medidaConMargen', formula: 'medidaBase * (1 + margenPct / 100)', unit: 'm2', precision: 3 },
      { id: ASSISTANT_BASE_DERIVED_ID, formula: 'medidaConMargen * cantidad', unit: 'm2', precision: 3 }
    ],
    model3d: {
      dims: { xId: 'largo', yId: 'ancho', zId: 'altoVisual' },
      labels: { x: 'Largo', y: 'Ancho', z: 'Espesor visual' }
    }
  },
  volume: {
    id: 'volume',
    title: 'Volumen (m3)',
    description: 'Para concreto, rellenos o cajas.',
    unitLabel: 'm3',
    baseMeasureLabel: 'volumen total',
    inputs: [
      { id: 'cantidad', label: 'Cuantos modulos', type: 'number', unit: 'pza', default: 1, required: true, min: 1, step: 1 },
      { id: 'largo', label: 'Largo', type: 'number', unit: 'm', unitOptions: ['m', 'cm', 'ft'], default: 4, required: true, min: 0.1, step: 0.01 },
      { id: 'ancho', label: 'Ancho', type: 'number', unit: 'm', unitOptions: ['m', 'cm', 'ft'], default: 3, required: true, min: 0.1, step: 0.01 },
      { id: 'alto', label: 'Alto', type: 'number', unit: 'm', unitOptions: ['m', 'cm', 'ft'], default: 2.5, required: true, min: 0.1, step: 0.01 },
      { id: 'margenPct', label: 'Margen extra (%)', type: 'number', unit: '%', default: 8, required: false, min: 0, max: 80, step: 0.1 }
    ],
    derived: [
      { id: 'medidaBase', formula: 'largo * ancho * alto', unit: 'm3', precision: 3 },
      { id: 'medidaConMargen', formula: 'medidaBase * (1 + margenPct / 100)', unit: 'm3', precision: 3 },
      { id: ASSISTANT_BASE_DERIVED_ID, formula: 'medidaConMargen * cantidad', unit: 'm3', precision: 3 }
    ],
    model3d: {
      dims: { xId: 'largo', yId: 'ancho', zId: 'alto' },
      labels: { x: 'Largo', y: 'Ancho', z: 'Alto' }
    }
  },
  linear: {
    id: 'linear',
    title: 'Distancia (m)',
    description: 'Para cable, tubo y recorridos lineales.',
    unitLabel: 'm',
    baseMeasureLabel: 'metros totales',
    inputs: [
      { id: 'cantidad', label: 'Cuantos tramos', type: 'number', unit: 'pza', default: 1, required: true, min: 1, step: 1 },
      { id: 'largoTramo', label: 'Largo de cada tramo', type: 'number', unit: 'm', unitOptions: ['m', 'cm', 'ft'], default: 10, required: true, min: 0.1, step: 0.01 },
      { id: 'margenPct', label: 'Margen extra (%)', type: 'number', unit: '%', default: 8, required: false, min: 0, max: 80, step: 0.1 },
      { id: 'altoVisual', label: 'Alto para vista 3D', type: 'number', unit: 'm', default: 0.2, required: false, min: 0.01, max: 5, step: 0.01 },
      { id: 'anchoVisual', label: 'Ancho para vista 3D', type: 'number', unit: 'm', default: 0.2, required: false, min: 0.01, max: 5, step: 0.01 }
    ],
    derived: [
      { id: 'medidaBase', formula: 'cantidad * largoTramo', unit: 'm', precision: 3 },
      { id: 'medidaConMargen', formula: 'medidaBase * (1 + margenPct / 100)', unit: 'm', precision: 3 },
      { id: ASSISTANT_BASE_DERIVED_ID, formula: 'medidaConMargen', unit: 'm', precision: 3 }
    ],
    model3d: {
      dims: { xId: 'largoTramo', yId: 'altoVisual', zId: 'anchoVisual' },
      labels: { x: 'Largo tramo', y: 'Alto visual', z: 'Ancho visual' }
    }
  },
  pieces: {
    id: 'pieces',
    title: 'Piezas (unit)',
    description: 'Para tornillos, cajas y unidades.',
    unitLabel: 'pza',
    baseMeasureLabel: 'piezas totales',
    inputs: [
      { id: 'cantidad', label: 'Cantidad de piezas', type: 'number', unit: 'pza', default: 50, required: true, min: 1, step: 1 },
      { id: 'margenPct', label: 'Margen extra (%)', type: 'number', unit: '%', default: 5, required: false, min: 0, max: 80, step: 0.1 },
      { id: 'largoPieza', label: 'Largo de 1 pieza (3D)', type: 'number', unit: 'm', default: 0.25, required: false, min: 0.01, step: 0.01 },
      { id: 'anchoPieza', label: 'Ancho de 1 pieza (3D)', type: 'number', unit: 'm', default: 0.2, required: false, min: 0.01, step: 0.01 },
      { id: 'altoPieza', label: 'Alto de 1 pieza (3D)', type: 'number', unit: 'm', default: 0.1, required: false, min: 0.01, step: 0.01 }
    ],
    derived: [
      { id: 'medidaBase', formula: 'cantidad', unit: 'pza', precision: 0 },
      { id: 'medidaConMargen', formula: 'medidaBase * (1 + margenPct / 100)', unit: 'pza', precision: 2 },
      { id: ASSISTANT_BASE_DERIVED_ID, formula: 'safeCeil(medidaConMargen, 1)', unit: 'pza', precision: 0 }
    ],
    model3d: {
      dims: { xId: 'largoPieza', yId: 'anchoPieza', zId: 'altoPieza' },
      labels: { x: 'Largo pieza', y: 'Ancho pieza', z: 'Alto pieza' }
    }
  }
};

function createDefaultAssistantMaterial(preset) {
  return {
    id: sanitizeId(`material_${Date.now()}`),
    name: 'Material principal',
    unit: preset.unitLabel,
    consumptionFactor: 1,
    wastePct: 0,
    defaultUnitCost: 0,
    rounding: preset.unitLabel === 'pza' ? 'ceil' : 'round',
    precision: defaultPrecision(preset.unitLabel)
  };
}

function inferPresetFromTemplate(template) {
  const ids = new Set((template.derived || []).map((item) => item.id));
  const hasStandard = ids.has('medidaBase') && ids.has('medidaConMargen') && ids.has(ASSISTANT_BASE_DERIVED_ID);
  if (hasStandard) {
    const base = (template.derived || []).find((item) => item.id === 'medidaBase');
    const unit = (base?.unit || '').toLowerCase();
    if (unit === 'm2') return 'area';
    if (unit === 'm3') return 'volume';
    if (unit === 'm') return 'linear';
    if (unit === 'pza' || unit === 'unit') return 'pieces';
  }

  const names = (template.inputs || []).map((item) => String(item.id || '').toLowerCase());
  if (names.includes('alto') && names.includes('ancho') && names.includes('largo')) return 'volume';
  if (names.includes('largotramo')) return 'linear';
  if (names.includes('largo') && names.includes('ancho')) return 'area';
  return 'pieces';
}

function inferConsumptionFactor(formula, baseId) {
  const source = String(formula || '').replace(/\s+/g, '');
  if (!source || source === baseId) return 1;

  const escapedBase = baseId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const leftPattern = new RegExp(`^\\(?([0-9]+(?:\\.[0-9]+)?)\\)?\\*${escapedBase}$`);
  const rightPattern = new RegExp(`^${escapedBase}\\*\\(?([0-9]+(?:\\.[0-9]+)?)\\)?$`);
  const left = source.match(leftPattern);
  if (left) return Number(left[1]);
  const right = source.match(rightPattern);
  if (right) return Number(right[1]);
  return 1;
}

function createAssistantConfigFromTemplate(template) {
  const presetId = inferPresetFromTemplate(template);
  const preset = ASSISTANT_PRESETS[presetId] || ASSISTANT_PRESETS.area;
  const rows = (template.materials || []).map((item, index) => {
    const unit = item.unit || preset.unitLabel;
    return {
      id: sanitizeId(item.id || item.name || `material_${index + 1}`),
      name: item.name || `Material ${index + 1}`,
      unit,
      consumptionFactor: inferConsumptionFactor(item.qtyFormula, ASSISTANT_BASE_DERIVED_ID),
      wastePct: Number.isFinite(Number(item.wastePct)) ? Number(item.wastePct) : 0,
      defaultUnitCost: Number.isFinite(Number(item.defaultUnitCost)) ? Number(item.defaultUnitCost) : 0,
      rounding: item.rounding || (unit === 'pza' ? 'ceil' : 'round'),
      precision: Number.isFinite(Number(item.precision)) ? Number(item.precision) : defaultPrecision(unit)
    };
  });

  return {
    name: template.name || 'Plantilla universal',
    currency: template.currency || 'Q',
    description: template.description || 'Plantilla creada con el asistente guiado.',
    presetId,
    includeLabor: Boolean(template.summary?.includeLabor),
    includeFixedCost: Boolean(template.summary?.includeFixedCost),
    includeTax: Boolean(template.summary?.includeTax),
    materials: rows.length ? rows : [createDefaultAssistantMaterial(preset)]
  };
}

function buildTemplateFromAssistant(sourceTemplate, assistant) {
  const preset = ASSISTANT_PRESETS[assistant.presetId] || ASSISTANT_PRESETS.area;
  const used = new Set();

  const materials = assistant.materials.map((row, index) => {
    const baseId = sanitizeId(row.id || row.name || `material_${index + 1}`, `material_${index + 1}`);
    let itemId = baseId;
    let counter = 2;
    while (used.has(itemId)) {
      itemId = `${baseId}_${counter}`;
      counter += 1;
    }
    used.add(itemId);

    const factor = toPositiveNumber(row.consumptionFactor, 1);
    const unit = String(row.unit || preset.unitLabel || 'unit').trim() || 'unit';
    return {
      id: itemId,
      name: String(row.name || `Material ${index + 1}`),
      qtyFormula: factor === 1 ? ASSISTANT_BASE_DERIVED_ID : `(${factor}) * ${ASSISTANT_BASE_DERIVED_ID}`,
      unit,
      wastePct: toPositiveNumber(row.wastePct, 0),
      defaultUnitCost: toPositiveNumber(row.defaultUnitCost, 0),
      rounding: row.rounding || (unit === 'pza' ? 'ceil' : 'round'),
      precision: Number.isFinite(Number(row.precision)) ? Number(row.precision) : defaultPrecision(unit)
    };
  });

  if (!materials.length) {
    const fallback = createDefaultAssistantMaterial(preset);
    materials.push({
      id: fallback.id,
      name: fallback.name,
      qtyFormula: ASSISTANT_BASE_DERIVED_ID,
      unit: fallback.unit,
      wastePct: fallback.wastePct,
      defaultUnitCost: fallback.defaultUnitCost,
      rounding: fallback.rounding,
      precision: fallback.precision
    });
  }

  const inputs = deepClone(preset.inputs);
  if (assistant.includeLabor) {
    inputs.push({ id: 'manoObra', label: 'Mano de obra', type: 'number', unit: 'Q', default: 0, required: false, min: 0, step: 1 });
  }
  if (assistant.includeFixedCost) {
    inputs.push({ id: 'costoFijo', label: 'Costo fijo', type: 'number', unit: 'Q', default: 0, required: false, min: 0, step: 1 });
  }
  if (assistant.includeTax) {
    inputs.push({ id: 'impuestoPct', label: 'Impuesto (%)', type: 'number', unit: '%', default: 0, required: false, min: 0, max: 100, step: 0.1 });
  }

  return {
    templateId: sourceTemplate.templateId || `tpl-${Date.now()}`,
    name: String(assistant.name || sourceTemplate.name || 'Plantilla universal'),
    version: String(sourceTemplate.version || '1.0.0'),
    currency: String(assistant.currency || sourceTemplate.currency || 'Q'),
    description: String(assistant.description || sourceTemplate.description || `Plantilla universal guiada (${preset.title}).`),
    inputs,
    derived: deepClone(preset.derived),
    materials,
    summary: {
      includeLabor: Boolean(assistant.includeLabor),
      laborInputId: 'manoObra',
      defaultLabor: 0,
      includeFixedCost: Boolean(assistant.includeFixedCost),
      fixedCostInputId: 'costoFijo',
      defaultFixedCost: 0,
      includeTax: Boolean(assistant.includeTax),
      taxPctInputId: 'impuestoPct',
      defaultTaxPct: 0,
      costPerDerivedId: ASSISTANT_BASE_DERIVED_ID
    },
    '3d': {
      enabled: true,
      dims: deepClone(preset.model3d.dims),
      labels: deepClone(preset.model3d.labels)
    }
  };
}

function createModalSkeleton() {
  const wrapper = document.createElement('section');
  wrapper.className = 'builder-modal hidden';
  wrapper.innerHTML = `
    <article class="builder-modal-card">
      <header class="builder-modal-head">
        <div>
          <h2>Constructor universal de plantilla</h2>
          <p>Modo asistido por pasos. Cambia a experto solo si necesitas formulas avanzadas.</p>
        </div>
        <button type="button" class="ghost-btn" data-action="close">Cerrar</button>
      </header>

      <section class="builder-mode-toggle" data-role="mode-toggle"></section>
      <nav class="builder-tabs" data-role="tabs"></nav>
      <section class="builder-tab-content" data-role="content"></section>

      <footer class="builder-modal-footer">
        <small class="builder-status" data-role="status"></small>
        <div class="actions wrap">
          <button type="button" class="ghost-btn" data-action="export-json">Copiar JSON</button>
          <button type="button" class="ghost-btn" data-action="close">Cancelar</button>
          <button type="button" data-action="save">Guardar plantilla</button>
        </div>
      </footer>
    </article>
  `;

  document.body.appendChild(wrapper);
  return wrapper;
}

function modeButton(modeId, label, active) {
  return `
    <button type="button" class="builder-mode-btn ${active ? 'active' : ''}" data-action="switch-mode" data-mode="${modeId}">${label}</button>
  `;
}

function tabButton(tabId, label, active) {
  return `<button type="button" class="builder-tab-btn ${active ? 'active' : ''}" data-tab="${tabId}">${label}</button>`;
}

function fieldRow(label, inputHtml) {
  return `
    <label class="builder-field">
      <span>${label}</span>
      ${inputHtml}
    </label>
  `;
}

export function createAdvancedBuilder({ onSave } = {}) {
  const modal = createModalSkeleton();
  const modeNode = modal.querySelector('[data-role="mode-toggle"]');
  const tabsNode = modal.querySelector('[data-role="tabs"]');
  const contentNode = modal.querySelector('[data-role="content"]');
  const statusNode = modal.querySelector('[data-role="status"]');

  let activeTab = 'meta';
  let builderMode = 'assistant';
  let draft = null;
  let assistantConfig = null;
  let assistantTouched = false;

  function setStatus(text, tone = 'muted') {
    statusNode.textContent = text || '';
    statusNode.dataset.tone = tone;
  }

  function renderModeToggle() {
    modeNode.innerHTML = `
      ${modeButton('assistant', 'Modo asistido', builderMode === 'assistant')}
      ${modeButton('expert', 'Modo experto', builderMode === 'expert')}
    `;
  }

  function renderTabs() {
    if (builderMode !== 'expert') {
      tabsNode.classList.add('hidden');
      tabsNode.innerHTML = '';
      return;
    }

    tabsNode.classList.remove('hidden');
    tabsNode.innerHTML = EXPERT_TABS.map((tab) => tabButton(tab.id, tab.label, tab.id === activeTab)).join('');
  }

  function rebuildDraftFromAssistant({ notify = false } = {}) {
    if (!draft || !assistantConfig) return;
    draft = ensureTemplateShape(buildTemplateFromAssistant(draft, assistantConfig));
    if (notify) setStatus('Asistente actualizado.', 'ok');
  }

  function renderAssistantTab() {
    const preset = ASSISTANT_PRESETS[assistantConfig.presetId] || ASSISTANT_PRESETS.area;
    const presetButtons = Object.values(ASSISTANT_PRESETS)
      .map((item) => `
        <button type="button" class="assistant-preset-btn ${assistantConfig.presetId === item.id ? 'active' : ''}" data-action="assistant-set-preset" data-preset="${item.id}">
          <strong>${item.title}</strong>
          <small>${item.description}</small>
        </button>
      `)
      .join('');

    const materialRows = assistantConfig.materials.map((item, index) => `
      <article class="assistant-material-card">
        <header>
          <strong>${escapeHtml(item.name || `Material ${index + 1}`)}</strong>
          <button type="button" class="danger" data-action="assistant-remove-material" data-index="${index}">Eliminar</button>
        </header>
        <div class="builder-grid-three">
          ${fieldRow('Nombre', `<input type="text" data-assistant-material="name" data-index="${index}" value="${escapeHtml(item.name || '')}" />`)}
          ${fieldRow('Unidad', `<input type="text" data-assistant-material="unit" data-index="${index}" value="${escapeHtml(item.unit || '')}" />`)}
          ${fieldRow(`Consumo por ${preset.baseMeasureLabel}`, `<input type="text" data-assistant-material="consumptionFactor" data-index="${index}" value="${escapeHtml(item.consumptionFactor ?? 1)}" />`)}
          ${fieldRow('Merma %', `<input type="text" data-assistant-material="wastePct" data-index="${index}" value="${escapeHtml(item.wastePct ?? 0)}" />`)}
          ${fieldRow('Costo unitario', `<input type="text" data-assistant-material="defaultUnitCost" data-index="${index}" value="${escapeHtml(item.defaultUnitCost ?? 0)}" />`)}
          ${fieldRow('Redondeo', `
            <select data-assistant-material="rounding" data-index="${index}">
              <option value="ceil" ${item.rounding === 'ceil' ? 'selected' : ''}>ceil</option>
              <option value="round" ${item.rounding === 'round' ? 'selected' : ''}>round</option>
              <option value="none" ${item.rounding === 'none' ? 'selected' : ''}>none</option>
            </select>
          `)}
          ${fieldRow('Decimales', `<input type="text" data-assistant-material="precision" data-index="${index}" value="${escapeHtml(item.precision ?? defaultPrecision(item.unit))}" />`)}
        </div>
        <p class="muted small">Formula interna: consumo x ${ASSISTANT_BASE_DERIVED_ID}.</p>
      </article>
    `).join('');

    return `
      <section class="assistant-stack">
        <article class="assistant-card">
          <h3>Paso 1: Nombra tu plantilla</h3>
          <div class="builder-grid-two">
            ${fieldRow('Nombre visible', `<input type="text" data-assistant="name" value="${escapeHtml(assistantConfig.name || '')}" />`)}
            ${fieldRow('Moneda', `<input type="text" data-assistant="currency" value="${escapeHtml(assistantConfig.currency || 'Q')}" />`)}
          </div>
          ${fieldRow('Descripcion corta', `<textarea rows="2" data-assistant="description">${escapeHtml(assistantConfig.description || '')}</textarea>`)}
        </article>

        <article class="assistant-card">
          <h3>Paso 2: Que quieres calcular</h3>
          <div class="assistant-preset-grid">${presetButtons}</div>
          <p class="muted">Base actual: <strong>${preset.baseMeasureLabel}</strong> (${preset.unitLabel}).</p>
        </article>

        <article class="assistant-card">
          <h3>Paso 3: Materiales en lenguaje simple</h3>
          <p class="muted">Agrega lo que compras. El sistema aplica consumo, merma y costo automaticamente.</p>
          <div class="builder-list">${materialRows}</div>
          <div class="actions wrap">
            <button type="button" data-action="assistant-add-material">+ Agregar material</button>
          </div>
        </article>

        <article class="assistant-card">
          <h3>Paso 4: Extras de precio</h3>
          <div class="builder-grid-three">
            ${fieldRow('Incluir mano de obra', `
              <select data-assistant="includeLabor">
                <option value="true" ${assistantConfig.includeLabor ? 'selected' : ''}>si</option>
                <option value="false" ${!assistantConfig.includeLabor ? 'selected' : ''}>no</option>
              </select>
            `)}
            ${fieldRow('Incluir costo fijo', `
              <select data-assistant="includeFixedCost">
                <option value="true" ${assistantConfig.includeFixedCost ? 'selected' : ''}>si</option>
                <option value="false" ${!assistantConfig.includeFixedCost ? 'selected' : ''}>no</option>
              </select>
            `)}
            ${fieldRow('Incluir impuesto', `
              <select data-assistant="includeTax">
                <option value="true" ${assistantConfig.includeTax ? 'selected' : ''}>si</option>
                <option value="false" ${!assistantConfig.includeTax ? 'selected' : ''}>no</option>
              </select>
            `)}
          </div>
        </article>

        <article class="assistant-card assistant-final-card">
          <h3>Paso 5: Guardar</h3>
          <p class="muted">Ya puedes guardar. Para formulas libres abre modo experto.</p>
          <div class="actions wrap">
            <button type="button" class="ghost-btn" data-action="assistant-open-expert">Abrir modo experto</button>
          </div>
        </article>
      </section>
    `;
  }

  function renderMetaTab() {
    return `
      <div class="builder-grid-two">
        ${fieldRow('Template ID', `<input type="text" data-path="templateId" value="${escapeHtml(draft.templateId || '')}" />`)}
        ${fieldRow('Nombre', `<input type="text" data-path="name" value="${escapeHtml(draft.name || '')}" />`)}
        ${fieldRow('Version', `<input type="text" data-path="version" value="${escapeHtml(draft.version || '1.0.0')}" />`)}
        ${fieldRow('Moneda', `<input type="text" data-path="currency" value="${escapeHtml(draft.currency || 'Q')}" />`)}
      </div>
      ${fieldRow('Descripcion', `<textarea rows="3" data-path="description">${escapeHtml(draft.description || '')}</textarea>`)}
      <p class="muted small">Tip: usa IDs cortos sin espacios, por ejemplo: largoCasa, areaParedes, costoBloque.</p>
    `;
  }

  function renderInputsTab() {
    const rows = (draft.inputs || []).map((input, index) => `
      <article class="builder-item-card" data-collection="inputs" data-index="${index}">
        <header>
          <strong>${escapeHtml(input.label || input.id || `Input ${index + 1}`)}</strong>
          <button type="button" class="danger" data-action="remove-input" data-index="${index}">Eliminar</button>
        </header>
        <div class="builder-grid-three">
          ${fieldRow('ID', `<input type="text" data-input="id" value="${escapeHtml(input.id || '')}" data-index="${index}" />`)}
          ${fieldRow('Label', `<input type="text" data-input="label" value="${escapeHtml(input.label || '')}" data-index="${index}" />`)}
          ${fieldRow('Tipo', `
            <select data-input="type" data-index="${index}">
              <option value="number" ${input.type === 'number' ? 'selected' : ''}>number</option>
              <option value="select" ${input.type === 'select' ? 'selected' : ''}>select</option>
              <option value="text" ${input.type === 'text' ? 'selected' : ''}>text</option>
            </select>
          `)}
          ${fieldRow('Unidad', `<input type="text" data-input="unit" value="${escapeHtml(input.unit || '')}" data-index="${index}" />`)}
          ${fieldRow('Default', `<input type="text" data-input="default" value="${escapeHtml(input.default ?? '')}" data-index="${index}" />`)}
          ${fieldRow('Required', `
            <select data-input="required" data-index="${index}">
              <option value="true" ${input.required ? 'selected' : ''}>true</option>
              <option value="false" ${!input.required ? 'selected' : ''}>false</option>
            </select>
          `)}
          ${fieldRow('Min', `<input type="text" data-input="min" value="${escapeHtml(input.min ?? '')}" data-index="${index}" />`)}
          ${fieldRow('Max', `<input type="text" data-input="max" value="${escapeHtml(input.max ?? '')}" data-index="${index}" />`)}
          ${fieldRow('Step', `<input type="text" data-input="step" value="${escapeHtml(input.step ?? '')}" data-index="${index}" />`)}
        </div>
        ${fieldRow('Ayuda', `<input type="text" data-input="help" value="${escapeHtml(input.help || '')}" data-index="${index}" />`)}
        ${fieldRow('Opciones select (valor:label, ...)', `<input type="text" data-input="options" value="${escapeHtml(Array.isArray(input.options) ? input.options.map((opt) => (typeof opt === 'object' ? `${opt.value}:${opt.label || opt.value}` : String(opt))).join(', ') : '')}" data-index="${index}" />`)}
        ${fieldRow('Unidades opcionales (m, cm, ft)', `<input type="text" data-input="unitOptions" value="${escapeHtml(Array.isArray(input.unitOptions) ? input.unitOptions.join(', ') : '')}" data-index="${index}" />`)}
      </article>
    `).join('');

    return `
      <div class="actions wrap">
        <button type="button" data-action="add-input">+ Agregar input</button>
      </div>
      <div class="builder-list">${rows || '<p class="muted">No hay inputs.</p>'}</div>
    `;
  }

  function renderDerivedTab() {
    const rows = (draft.derived || []).map((item, index) => `
      <article class="builder-item-card" data-collection="derived" data-index="${index}">
        <header>
          <strong>${escapeHtml(item.id || `Formula ${index + 1}`)}</strong>
          <button type="button" class="danger" data-action="remove-derived" data-index="${index}">Eliminar</button>
        </header>
        <div class="builder-grid-three">
          ${fieldRow('ID', `<input type="text" data-derived="id" value="${escapeHtml(item.id || '')}" data-index="${index}" />`)}
          ${fieldRow('Unidad', `<input type="text" data-derived="unit" value="${escapeHtml(item.unit || '')}" data-index="${index}" />`)}
          ${fieldRow('Precision', `<input type="text" data-derived="precision" value="${escapeHtml(item.precision ?? '')}" data-index="${index}" />`)}
        </div>
        ${fieldRow('Formula', `<input type="text" data-derived="formula" value="${escapeHtml(item.formula || '')}" data-index="${index}" />`)}
      </article>
    `).join('');

    return `
      <div class="actions wrap">
        <button type="button" data-action="add-derived">+ Agregar formula</button>
      </div>
      <div class="builder-list">${rows || '<p class="muted">No hay formulas.</p>'}</div>
    `;
  }
  function renderMaterialsTab() {
    const rows = (draft.materials || []).map((item, index) => `
      <article class="builder-item-card" data-collection="materials" data-index="${index}">
        <header>
          <strong>${escapeHtml(item.name || item.id || `Material ${index + 1}`)}</strong>
          <button type="button" class="danger" data-action="remove-material" data-index="${index}">Eliminar</button>
        </header>
        <div class="builder-grid-three">
          ${fieldRow('ID', `<input type="text" data-material="id" value="${escapeHtml(item.id || '')}" data-index="${index}" />`)}
          ${fieldRow('Nombre', `<input type="text" data-material="name" value="${escapeHtml(item.name || '')}" data-index="${index}" />`)}
          ${fieldRow('Unidad', `<input type="text" data-material="unit" value="${escapeHtml(item.unit || '')}" data-index="${index}" />`)}
          ${fieldRow('Desperdicio %', `<input type="text" data-material="wastePct" value="${escapeHtml(item.wastePct ?? 0)}" data-index="${index}" />`)}
          ${fieldRow('Costo default', `<input type="text" data-material="defaultUnitCost" value="${escapeHtml(item.defaultUnitCost ?? 0)}" data-index="${index}" />`)}
          ${fieldRow('Costo desde input ID', `<input type="text" data-material="unitCostInputId" value="${escapeHtml(item.unitCostInputId || '')}" data-index="${index}" />`)}
          ${fieldRow('Rounding', `
            <select data-material="rounding" data-index="${index}">
              <option value="ceil" ${item.rounding === 'ceil' ? 'selected' : ''}>ceil</option>
              <option value="round" ${item.rounding === 'round' ? 'selected' : ''}>round</option>
              <option value="none" ${item.rounding === 'none' ? 'selected' : ''}>none</option>
            </select>
          `)}
          ${fieldRow('Precision', `<input type="text" data-material="precision" value="${escapeHtml(item.precision ?? '')}" data-index="${index}" />`)}
          ${fieldRow('Ayuda', `<input type="text" data-material="help" value="${escapeHtml(item.help || '')}" data-index="${index}" />`)}
        </div>
        ${fieldRow('Formula cantidad', `<input type="text" data-material="qtyFormula" value="${escapeHtml(item.qtyFormula || '')}" data-index="${index}" />`)}
      </article>
    `).join('');

    return `
      <div class="actions wrap">
        <button type="button" data-action="add-material">+ Agregar material</button>
      </div>
      <div class="builder-list">${rows || '<p class="muted">No hay materiales.</p>'}</div>
    `;
  }

  function renderSummaryTab() {
    const summary = draft.summary || {};
    return `
      <div class="builder-grid-two">
        ${fieldRow('Incluir mano de obra', `
          <select data-summary="includeLabor">
            <option value="true" ${summary.includeLabor ? 'selected' : ''}>true</option>
            <option value="false" ${!summary.includeLabor ? 'selected' : ''}>false</option>
          </select>
        `)}
        ${fieldRow('ID input mano de obra', `<input type="text" data-summary="laborInputId" value="${escapeHtml(summary.laborInputId || '')}" />`)}
        ${fieldRow('Incluir costo fijo', `
          <select data-summary="includeFixedCost">
            <option value="true" ${summary.includeFixedCost ? 'selected' : ''}>true</option>
            <option value="false" ${!summary.includeFixedCost ? 'selected' : ''}>false</option>
          </select>
        `)}
        ${fieldRow('ID input costo fijo', `<input type="text" data-summary="fixedCostInputId" value="${escapeHtml(summary.fixedCostInputId || '')}" />`)}
        ${fieldRow('Incluir impuesto', `
          <select data-summary="includeTax">
            <option value="true" ${summary.includeTax ? 'selected' : ''}>true</option>
            <option value="false" ${!summary.includeTax ? 'selected' : ''}>false</option>
          </select>
        `)}
        ${fieldRow('ID input impuesto %', `<input type="text" data-summary="taxPctInputId" value="${escapeHtml(summary.taxPctInputId || '')}" />`)}
        ${fieldRow('Costo por input ID', `<input type="text" data-summary="costPerInputId" value="${escapeHtml(summary.costPerInputId || '')}" />`)}
        ${fieldRow('Costo por derived ID', `<input type="text" data-summary="costPerDerivedId" value="${escapeHtml(summary.costPerDerivedId || '')}" />`)}
      </div>
    `;
  }

  function render3dTab() {
    const model = draft['3d'] || { enabled: true, dims: {} };
    model.dims = model.dims || {};

    return `
      <div class="builder-grid-two">
        ${fieldRow('Habilitar vista 3D', `
          <select data-model3d="enabled">
            <option value="true" ${model.enabled ? 'selected' : ''}>true</option>
            <option value="false" ${!model.enabled ? 'selected' : ''}>false</option>
          </select>
        `)}
        ${fieldRow('Dimension X (ID)', `<input type="text" data-model3d="xId" value="${escapeHtml(model.dims.xId || '')}" />`)}
        ${fieldRow('Dimension Y (ID)', `<input type="text" data-model3d="yId" value="${escapeHtml(model.dims.yId || '')}" />`)}
        ${fieldRow('Dimension Z (ID)', `<input type="text" data-model3d="zId" value="${escapeHtml(model.dims.zId || '')}" />`)}
      </div>
    `;
  }

  function renderRawTab() {
    return `
      <label class="builder-field">
        <span>Editor JSON (opcional)</span>
        <textarea rows="18" data-raw-editor>${JSON.stringify(draft, null, 2)}</textarea>
      </label>
      <div class="actions wrap">
        <button type="button" data-action="apply-raw">Aplicar JSON</button>
      </div>
    `;
  }

  function renderContent() {
    if (!draft) return;

    if (builderMode === 'assistant') {
      contentNode.innerHTML = renderAssistantTab();
      setStatus('Modo asistido activo. Configura con preguntas simples.', 'muted');
      return;
    }

    if (activeTab === 'meta') contentNode.innerHTML = renderMetaTab();
    else if (activeTab === 'inputs') contentNode.innerHTML = renderInputsTab();
    else if (activeTab === 'derived') contentNode.innerHTML = renderDerivedTab();
    else if (activeTab === 'materials') contentNode.innerHTML = renderMaterialsTab();
    else if (activeTab === 'summary') contentNode.innerHTML = renderSummaryTab();
    else if (activeTab === 'model3d') contentNode.innerHTML = render3dTab();
    else contentNode.innerHTML = renderRawTab();

    setStatus('Edicion experta activa.', 'muted');
  }

  function render() {
    renderModeToggle();
    renderTabs();
    renderContent();
  }

  function close() {
    modal.classList.add('hidden');
  }

  function open(template, options = {}) {
    draft = ensureTemplateShape(template);
    assistantConfig = createAssistantConfigFromTemplate(draft);
    assistantTouched = false;
    activeTab = 'meta';
    builderMode = options.mode === 'expert' ? 'expert' : 'assistant';

    const shouldBootstrapAssistant = Boolean(options.forceAssistant)
      || (
        builderMode === 'assistant'
        && draft.inputs.length === 0
        && draft.derived.length === 0
        && draft.materials.length === 0
      );

    if (shouldBootstrapAssistant) {
      assistantTouched = true;
      rebuildDraftFromAssistant();
    }

    modal.classList.remove('hidden');
    render();
  }

  function updateAtPath(path, value) {
    draft[path] = value;
  }

  function removeItem(collection, index) {
    draft[collection].splice(index, 1);
  }

  function parseOptions(raw) {
    return String(raw || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        if (!item.includes(':')) return item;
        const [value, label] = item.split(':');
        return { value: value.trim(), label: label.trim() };
      });
  }

  function onContentInput(event) {
    const target = event.target;
    if (!target || !draft) return;

    if (target.dataset.assistant) {
      const key = target.dataset.assistant;
      const booleanFields = ['includeLabor', 'includeFixedCost', 'includeTax'];
      assistantConfig[key] = booleanFields.includes(key) ? parseBoolean(target.value) : target.value;
      assistantTouched = true;
      rebuildDraftFromAssistant();
      return;
    }

    if (target.dataset.assistantMaterial != null) {
      const index = Number(target.dataset.index);
      const key = target.dataset.assistantMaterial;
      const row = assistantConfig.materials[index];
      if (!row) return;

      if (['consumptionFactor', 'wastePct', 'defaultUnitCost', 'precision'].includes(key)) {
        row[key] = parseMaybeNumber(target.value) ?? 0;
      } else {
        row[key] = target.value;
      }
      assistantTouched = true;
      rebuildDraftFromAssistant();
      return;
    }

    if (target.dataset.path) {
      updateAtPath(target.dataset.path, target.value);
      return;
    }

    if (target.dataset.summary) {
      const key = target.dataset.summary;
      if (!draft.summary) draft.summary = {};
      const booleanFields = ['includeLabor', 'includeFixedCost', 'includeTax'];
      draft.summary[key] = booleanFields.includes(key) ? parseBoolean(target.value) : target.value;
      return;
    }

    if (target.dataset.model3d) {
      const key = target.dataset.model3d;
      if (!draft['3d']) draft['3d'] = { enabled: true, dims: {} };
      if (!draft['3d'].dims) draft['3d'].dims = {};

      if (key === 'enabled') {
        draft['3d'].enabled = parseBoolean(target.value);
      } else {
        draft['3d'].dims[key] = target.value;
      }
      return;
    }

    if (target.dataset.input != null) {
      const index = Number(target.dataset.index);
      const key = target.dataset.input;
      const item = draft.inputs[index];
      if (!item) return;

      if (key === 'required') item.required = parseBoolean(target.value);
      else if (['min', 'max', 'step', 'default'].includes(key)) {
        const parsed = parseMaybeNumber(target.value);
        item[key] = parsed == null ? target.value : parsed;
      } else if (key === 'options') {
        item.options = parseOptions(target.value);
      } else if (key === 'unitOptions') {
        item.unitOptions = String(target.value || '')
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean);
      } else {
        item[key] = target.value;
      }
      return;
    }

    if (target.dataset.derived != null) {
      const index = Number(target.dataset.index);
      const key = target.dataset.derived;
      const item = draft.derived[index];
      if (!item) return;

      if (key === 'precision') {
        const parsed = parseMaybeNumber(target.value);
        item[key] = parsed == null ? '' : parsed;
      } else {
        item[key] = target.value;
      }
      return;
    }

    if (target.dataset.material != null) {
      const index = Number(target.dataset.index);
      const key = target.dataset.material;
      const item = draft.materials[index];
      if (!item) return;

      if (['wastePct', 'defaultUnitCost', 'precision'].includes(key)) {
        const parsed = parseMaybeNumber(target.value);
        item[key] = parsed == null ? '' : parsed;
      } else {
        item[key] = target.value;
      }
    }
  }

  function addInput() {
    draft.inputs.push({
      id: uid('input'),
      label: 'Nuevo input',
      type: 'number',
      unit: 'm',
      default: 0,
      required: true,
      min: 0,
      step: 0.1,
      help: ''
    });
  }

  function addDerived() {
    draft.derived.push({
      id: uid('derived'),
      formula: '0',
      unit: '',
      precision: 2
    });
  }

  function addMaterial() {
    draft.materials.push({
      id: uid('material'),
      name: 'Nuevo material',
      qtyFormula: '0',
      unit: 'unit',
      wastePct: 0,
      defaultUnitCost: 0,
      rounding: 'ceil',
      precision: 0
    });
  }

  function addAssistantMaterial() {
    const preset = ASSISTANT_PRESETS[assistantConfig.presetId] || ASSISTANT_PRESETS.area;
    assistantConfig.materials.push(createDefaultAssistantMaterial(preset));
    assistantTouched = true;
    rebuildDraftFromAssistant();
  }

  function applyRawJson() {
    const raw = contentNode.querySelector('[data-raw-editor]')?.value;
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);
      draft = ensureTemplateShape(parsed);
      assistantConfig = createAssistantConfigFromTemplate(draft);
      assistantTouched = false;
      setStatus('JSON aplicado correctamente.', 'ok');
      render();
    } catch (error) {
      setStatus(`JSON invalido: ${String(error.message || error)}`, 'error');
    }
  }

  async function persistTemplate() {
    try {
      if (builderMode === 'assistant' && assistantTouched) {
        rebuildDraftFromAssistant();
      }

      const normalized = ensureTemplateShape(draft);
      const result = calculator.calculate(normalized, calculator.buildDefaultInputState(normalized));

      if (!result.ok) {
        setStatus(`No se puede guardar: ${result.errors[0]}`, 'error');
        return;
      }

      if (typeof onSave === 'function') {
        await onSave(deepClone(normalized));
      }

      setStatus('Plantilla guardada.', 'ok');
      close();
    } catch (error) {
      setStatus(String(error.message || error), 'error');
    }
  }

  function switchMode(nextMode) {
    if (nextMode === builderMode) return;
    if (nextMode !== 'assistant' && nextMode !== 'expert') return;

    if (nextMode === 'assistant') {
      assistantConfig = createAssistantConfigFromTemplate(draft);
      assistantTouched = false;
    } else if (builderMode === 'assistant' && assistantTouched) {
      rebuildDraftFromAssistant();
    }

    builderMode = nextMode;
    render();
  }

  modal.addEventListener('click', (event) => {
    const target = event.target;
    const action = target?.dataset?.action;
    const tab = target?.dataset?.tab;

    if (tab) {
      activeTab = tab;
      render();
      return;
    }

    if (!action) {
      if (target === modal) close();
      return;
    }

    if (action === 'close') {
      close();
      return;
    }

    if (action === 'switch-mode') {
      switchMode(target.dataset.mode);
      return;
    }

    if (action === 'assistant-open-expert') {
      switchMode('expert');
      return;
    }

    if (action === 'assistant-set-preset') {
      const presetId = target.dataset.preset;
      if (!ASSISTANT_PRESETS[presetId]) return;
      assistantConfig.presetId = presetId;
      assistantConfig.materials = assistantConfig.materials.length
        ? assistantConfig.materials.map((row) => ({ ...row, unit: row.unit || ASSISTANT_PRESETS[presetId].unitLabel }))
        : [createDefaultAssistantMaterial(ASSISTANT_PRESETS[presetId])];
      assistantTouched = true;
      rebuildDraftFromAssistant();
      render();
      return;
    }

    if (action === 'assistant-add-material') {
      addAssistantMaterial();
      render();
      return;
    }

    if (action === 'assistant-remove-material') {
      const index = Number(target.dataset.index);
      assistantConfig.materials.splice(index, 1);
      if (!assistantConfig.materials.length) {
        const preset = ASSISTANT_PRESETS[assistantConfig.presetId] || ASSISTANT_PRESETS.area;
        assistantConfig.materials.push(createDefaultAssistantMaterial(preset));
      }
      assistantTouched = true;
      rebuildDraftFromAssistant();
      render();
      return;
    }

    if (action === 'save') {
      persistTemplate();
      return;
    }

    if (action === 'export-json') {
      navigator.clipboard.writeText(JSON.stringify(draft, null, 2))
        .then(() => setStatus('JSON copiado al portapapeles.', 'ok'))
        .catch(() => setStatus('No se pudo copiar JSON.', 'error'));
      return;
    }

    if (action === 'add-input') {
      addInput();
      render();
      return;
    }

    if (action === 'remove-input') {
      removeItem('inputs', Number(target.dataset.index));
      render();
      return;
    }

    if (action === 'add-derived') {
      addDerived();
      render();
      return;
    }

    if (action === 'remove-derived') {
      removeItem('derived', Number(target.dataset.index));
      render();
      return;
    }

    if (action === 'add-material') {
      addMaterial();
      render();
      return;
    }

    if (action === 'remove-material') {
      removeItem('materials', Number(target.dataset.index));
      render();
      return;
    }

    if (action === 'apply-raw') {
      applyRawJson();
    }
  });

  modal.addEventListener('input', onContentInput);
  modal.addEventListener('change', onContentInput);

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });

  return {
    open,
    close,
    isOpen: () => !modal.classList.contains('hidden')
  };
}
