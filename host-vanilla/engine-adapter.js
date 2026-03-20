import { runProjection, validateTemplate } from "../engine/dist/index.js";

export function validateTemplateSafe(template) {
  try {
    return validateTemplate(template);
  } catch (error) {
    return {
      ok: false,
      errors: [String(error?.message || error)],
      warnings: []
    };
  }
}

export function runProjectionSafe(template, inputs = {}) {
  const validation = validateTemplateSafe(template);
  if (!validation.ok) {
    return {
      ok: false,
      error: `Template invalid: ${validation.errors.join(" | ")}`,
      validation
    };
  }

  try {
    const result = runProjection(template, inputs);
    return {
      ok: true,
      result,
      validation
    };
  } catch (error) {
    return {
      ok: false,
      error: String(error?.message || error),
      validation
    };
  }
}
