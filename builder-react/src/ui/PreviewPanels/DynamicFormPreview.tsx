import type { ProjectionResult, Template } from "../../../../engine/types";

interface DynamicFormPreviewProps {
  template: Template;
  inputs: Record<string, unknown>;
  result: ProjectionResult | null;
  onInputChange: (key: string, value: unknown) => void;
  onGenerateExample: () => void;
}

function isHiddenField(result: ProjectionResult | null, key: string): boolean {
  if (!result) return false;
  return result.visibility.hiddenFields.includes(key);
}

export default function DynamicFormPreview({
  template,
  inputs,
  result,
  onInputChange,
  onGenerateExample
}: DynamicFormPreviewProps) {
  return (
    <section className="preview-card">
      <header className="preview-head">
        <h3>Vista previa del formulario</h3>
        <button type="button" onClick={onGenerateExample}>Generar ejemplo</button>
      </header>

      <div className="dynamic-grid">
        {template.inputs.map((field) => {
          if (isHiddenField(result, field.key)) return null;

          const value = inputs[field.key] ?? field.default ?? "";

          return (
            <label key={field.key} className="dyn-field">
              <span>{field.label}</span>
              {field.type === "select" ? (
                <select
                  value={String(value)}
                  onChange={(event) => onInputChange(field.key, event.target.value)}
                >
                  {(field.options || []).map((option) => (
                    <option key={`${field.key}-${String(option.value)}`} value={String(option.value)}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : field.type === "boolean" ? (
                <select
                  value={String(Boolean(value))}
                  onChange={(event) => onInputChange(field.key, event.target.value === "true")}
                >
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              ) : (
                <input
                  type={field.type === "text" ? "text" : "number"}
                  value={String(value)}
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  onChange={(event) => onInputChange(field.key, field.type === "text" ? event.target.value : Number(event.target.value))}
                />
              )}
              {field.helpText ? <small>{field.helpText}</small> : null}
            </label>
          );
        })}
      </div>
    </section>
  );
}

