import type { ProjectionResult, Template, TemplateValidationResult } from "../../../../engine/types";

interface StepPreviewProps {
  template: Template;
  validation: TemplateValidationResult;
  result: ProjectionResult | null;
  onSaveTemplate: () => void;
  onExportTemplate: () => void;
  onRunProjection: () => void;
}

export default function StepPreview({
  template,
  validation,
  result,
  onSaveTemplate,
  onExportTemplate,
  onRunProjection
}: StepPreviewProps) {
  return (
    <section className="wizard-step">
      <header className="step-head">
        <h3>Paso 6 - Validar y publicar</h3>
      </header>

      <article className="editor-card">
        <div className="row">
          <label>
            ID de plantilla
            <input value={template.id} readOnly />
          </label>
          <label>
            Nombre
            <input value={template.name} readOnly />
          </label>
          <label>
            Version
            <input value={template.version} readOnly />
          </label>
        </div>

        <div className="actions wrap">
          <button type="button" onClick={onRunProjection}>Ejecutar vista previa</button>
          <button type="button" onClick={onSaveTemplate}>Guardar plantilla</button>
          <button type="button" onClick={onExportTemplate}>Exportar JSON</button>
        </div>

        <div className="validation-box">
          <strong>Validacion</strong>
          <p>Estado: {validation.ok ? "OK" : "ERROR"}</p>
          {validation.errors.length > 0 ? (
            <ul>
              {validation.errors.map((error, idx) => <li key={`e-${idx}`}>{error}</li>)}
            </ul>
          ) : null}
          {validation.warnings.length > 0 ? (
            <ul>
              {validation.warnings.map((warning, idx) => <li key={`w-${idx}`}>{warning}</li>)}
            </ul>
          ) : null}
        </div>

        {result ? (
          <div className="validation-box">
            <strong>Resumen de proyeccion</strong>
            <p>Lineas: {result.lines.length}</p>
            <p>Total: {result.totals.grandTotal.toFixed(2)}</p>
            <p>Precision: {result.precisionScore}</p>
          </div>
        ) : null}
      </article>
    </section>
  );
}

