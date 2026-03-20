import type { Field, Template } from "../../../../engine/types";
import DragList from "../components/DragList";
import UnitPicker from "../components/UnitPicker";

interface StepInputsProps {
  template: Template;
  onChange: (next: Template) => void;
}

function createField(): Field {
  const stamp = Date.now();
  return {
    key: `input_${stamp}`,
    label: "Nuevo campo",
    type: "number",
    default: 0,
    min: 0,
    step: 1
  };
}

export default function StepInputs({ template, onChange }: StepInputsProps) {
  const inputDragItems = template.inputs.map((field) => ({
    id: field.key,
    label: field.label,
    subtitle: `${field.type}${field.unit ? ` | ${field.unit}` : ""}`
  }));

  function updateField(index: number, patch: Partial<Field>) {
    const nextInputs = [...template.inputs];
    nextInputs[index] = { ...nextInputs[index], ...patch };
    onChange({ ...template, inputs: nextInputs });
  }

  function removeField(index: number) {
    const nextInputs = template.inputs.filter((_, idx) => idx !== index);
    onChange({ ...template, inputs: nextInputs });
  }

  return (
    <section className="wizard-step">
      <header className="step-head">
        <h3>Paso 1 - Entradas</h3>
        <button
          type="button"
          onClick={() => onChange({ ...template, inputs: [...template.inputs, createField()] })}
        >
          + Agregar campo
        </button>
      </header>

      <DragList
        title="Arrastra para ordenar"
        items={inputDragItems}
        onReorder={(items) => {
          const byKey = new Map(template.inputs.map((field) => [field.key, field]));
          const nextInputs = items.map((item) => byKey.get(item.id)).filter(Boolean) as Field[];
          onChange({ ...template, inputs: nextInputs });
        }}
      />

      <div className="editor-list">
        {template.inputs.map((field, index) => (
          <article key={field.key} className="editor-card">
            <div className="row">
              <label>
                Clave
                <input value={field.key} onChange={(event) => updateField(index, { key: event.target.value })} />
              </label>
              <label>
                Etiqueta
                <input value={field.label} onChange={(event) => updateField(index, { label: event.target.value })} />
              </label>
              <label>
                Tipo
                <select value={field.type} onChange={(event) => updateField(index, { type: event.target.value as Field["type"] })}>
                  <option value="number">number</option>
                  <option value="int">int</option>
                  <option value="select">select</option>
                  <option value="boolean">boolean</option>
                  <option value="text">text</option>
                </select>
              </label>
              <label>
                Unidad
                <UnitPicker value={field.unit} onChange={(value) => updateField(index, { unit: value || undefined })} />
              </label>
            </div>

            <div className="row">
              <label>
                Min
                <input type="number" value={field.min ?? ""} onChange={(event) => updateField(index, { min: event.target.value === "" ? undefined : Number(event.target.value) })} />
              </label>
              <label>
                Max
                <input type="number" value={field.max ?? ""} onChange={(event) => updateField(index, { max: event.target.value === "" ? undefined : Number(event.target.value) })} />
              </label>
              <label>
                Step
                <input type="number" value={field.step ?? ""} onChange={(event) => updateField(index, { step: event.target.value === "" ? undefined : Number(event.target.value) })} />
              </label>
              <label>
                Requerido
                <select value={String(Boolean(field.required))} onChange={(event) => updateField(index, { required: event.target.value === "true" })}>
                  <option value="false">false</option>
                  <option value="true">true</option>
                </select>
              </label>
            </div>

            <div className="row">
              <label>
                Valor inicial
                <input value={String(field.default ?? "")} onChange={(event) => updateField(index, { default: event.target.value })} />
              </label>
              <label className="wide">
                Ayuda
                <input value={field.helpText || ""} onChange={(event) => updateField(index, { helpText: event.target.value || undefined })} />
              </label>
              <button type="button" className="danger" onClick={() => removeField(index)}>Eliminar</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

