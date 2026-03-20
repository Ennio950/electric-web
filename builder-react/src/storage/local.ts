import type { Template } from "../../../engine/types";

const STORAGE_KEY = "uwc.builder.templates.v1";

function parseSafe(raw: string | null): Template[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function listTemplates(): Template[] {
  return parseSafe(localStorage.getItem(STORAGE_KEY));
}

export function writeTemplates(templates: Template[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

export function upsertTemplate(template: Template): Template[] {
  const templates = listTemplates();
  const index = templates.findIndex((item) => item.id === template.id);
  if (index === -1) templates.unshift(template);
  else templates[index] = template;
  writeTemplates(templates);
  return templates;
}

export function removeTemplate(templateId: string): Template[] {
  const templates = listTemplates().filter((item) => item.id !== templateId);
  writeTemplates(templates);
  return templates;
}

function bumpVersion(version: string): string {
  const parts = String(version || "1.0.0").split(".").map((item) => Number(item) || 0);
  while (parts.length < 3) parts.push(0);
  parts[2] += 1;
  return `${parts[0]}.${parts[1]}.${parts[2]}`;
}

export function duplicateTemplate(template: Template): Template {
  const copy: Template = {
    ...template,
    id: `${template.id}-copy-${Date.now()}`,
    name: `${template.name} Copy`,
    version: bumpVersion(template.version)
  };
  upsertTemplate(copy);
  return copy;
}

