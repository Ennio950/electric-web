import { calculator } from './calculator.js';

const TEMPLATE_STORAGE_KEY = 'uqs.templates.v1';
const PROJECT_STORAGE_KEY = 'uqs.projects.v1';
const LAST_PROJECT_KEY = 'uqs.lastProject.v1';

function safeJsonParse(raw, fallback) {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function readLocalTemplates() {
  const raw = localStorage.getItem(TEMPLATE_STORAGE_KEY);
  if (!raw) return [];
  const parsed = safeJsonParse(raw, []);
  return Array.isArray(parsed) ? parsed : [];
}

function writeLocalTemplates(templates) {
  localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(templates, null, 2));
}

function readProjects() {
  const raw = localStorage.getItem(PROJECT_STORAGE_KEY);
  if (!raw) return [];
  const parsed = safeJsonParse(raw, []);
  return Array.isArray(parsed) ? parsed : [];
}

function writeProjects(projects) {
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(projects, null, 2));
}

function deepClone(data) {
  return JSON.parse(JSON.stringify(data));
}

async function loadDefaultTemplates(defaultPath = './data/templates.default.json') {
  const response = await fetch(defaultPath, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`No se pudo cargar plantillas demo (${response.status}).`);
  }

  const payload = await response.json();
  if (!payload || !Array.isArray(payload.templates)) {
    throw new Error('Archivo de plantillas demo invalido.');
  }

  return payload.templates;
}

function mergeTemplateLists(baseTemplates, overrideTemplates) {
  const map = new Map();

  baseTemplates.forEach((template) => {
    if (template?.templateId) {
      map.set(template.templateId, template);
    }
  });

  overrideTemplates.forEach((template) => {
    if (template?.templateId) {
      map.set(template.templateId, template);
    }
  });

  return Array.from(map.values());
}

export function normalizeImportedTemplates(list) {
  if (!Array.isArray(list)) {
    throw new Error('El JSON importado no contiene plantillas.');
  }

  const normalized = list.map((item, index) => {
    try {
      return calculator.normalizeTemplate(item);
    } catch (error) {
      throw new Error(`Plantilla ${index + 1}: ${String(error?.message || error)}`);
    }
  });

  if (!normalized.length) {
    throw new Error('No se detectaron plantillas validas en el archivo.');
  }

  return normalized;
}

async function initTemplates({ defaultPath } = {}) {
  const defaults = await loadDefaultTemplates(defaultPath);
  const current = readLocalTemplates();

  const initialized = current.length === 0
    ? defaults
    : mergeTemplateLists(defaults, current);

  writeLocalTemplates(initialized);
  return deepClone(initialized);
}

function getTemplates() {
  return deepClone(readLocalTemplates());
}

function getTemplateById(templateId) {
  return getTemplates().find((item) => item.templateId === templateId) || null;
}

function saveTemplate(template) {
  if (!template || !template.templateId) {
    throw new Error('Plantilla invalida para guardar.');
  }

  const list = readLocalTemplates();
  const index = list.findIndex((item) => item.templateId === template.templateId);
  if (index >= 0) list[index] = template;
  else list.unshift(template);

  writeLocalTemplates(list);
  return deepClone(template);
}

function deleteTemplate(templateId) {
  const list = readLocalTemplates();
  const next = list.filter((item) => item.templateId !== templateId);
  writeLocalTemplates(next);
  return deepClone(next);
}

function duplicateTemplate(templateId) {
  const source = getTemplateById(templateId);
  if (!source) throw new Error('No se encontro plantilla para duplicar.');

  const copy = deepClone(source);
  copy.templateId = `${source.templateId}-copy-${Date.now()}`;
  copy.name = `${source.name} (copia)`;
  copy.version = '1.0.0';

  saveTemplate(copy);
  return copy;
}

function importTemplatesFromJson(payload) {
  const parsed = typeof payload === 'string' ? safeJsonParse(payload, null) : payload;
  const list = Array.isArray(parsed) ? parsed : parsed?.templates;
  const cleaned = normalizeImportedTemplates(list);

  const merged = mergeTemplateLists(readLocalTemplates(), cleaned);
  writeLocalTemplates(merged);
  return deepClone(merged);
}

function exportTemplateAsJson(templateId) {
  const template = getTemplateById(templateId);
  if (!template) {
    throw new Error('No existe la plantilla a exportar.');
  }
  return JSON.stringify(template, null, 2);
}

function saveProject(project) {
  const record = {
    ...project,
    projectId: project.projectId || `prj-${Date.now()}`,
    createdAt: project.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const list = readProjects();
  const index = list.findIndex((item) => item.projectId === record.projectId);
  if (index >= 0) list[index] = record;
  else list.unshift(record);

  writeProjects(list);
  localStorage.setItem(LAST_PROJECT_KEY, JSON.stringify(record));
  return deepClone(record);
}

function getProjects() {
  return deepClone(readProjects());
}

function getLastProject() {
  const raw = localStorage.getItem(LAST_PROJECT_KEY);
  if (!raw) return null;
  return safeJsonParse(raw, null);
}

function exportProjectAsJson(projectId) {
  const project = readProjects().find((item) => item.projectId === projectId);
  if (!project) {
    throw new Error('No existe el proyecto a exportar.');
  }
  return JSON.stringify(project, null, 2);
}

function importProjectFromJson(payload) {
  const project = typeof payload === 'string' ? safeJsonParse(payload, null) : payload;
  if (!project || !project.templateId || !project.inputState) {
    throw new Error('Proyecto invalido. Debe incluir templateId e inputState.');
  }

  return saveProject(project);
}

function clearAllUserData() {
  localStorage.removeItem(TEMPLATE_STORAGE_KEY);
  localStorage.removeItem(PROJECT_STORAGE_KEY);
  localStorage.removeItem(LAST_PROJECT_KEY);
}

function toBlobDownload(filename, content, mime = 'application/json') {
  const blob = new Blob([content], { type: mime });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(href);
}

export const templateStore = {
  keys: {
    TEMPLATE_STORAGE_KEY,
    PROJECT_STORAGE_KEY,
    LAST_PROJECT_KEY
  },
  initTemplates,
  getTemplates,
  getTemplateById,
  saveTemplate,
  deleteTemplate,
  duplicateTemplate,
  importTemplatesFromJson,
  exportTemplateAsJson,
  saveProject,
  getProjects,
  getLastProject,
  exportProjectAsJson,
  importProjectFromJson,
  clearAllUserData,
  toBlobDownload
};
