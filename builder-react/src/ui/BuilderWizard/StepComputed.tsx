import type { ComputedVar, Template } from "../../../../engine/types";
import DragList from "../components/DragList";
import FormulaEditor from "../components/FormulaEditor";
import UnitPicker from "../components/UnitPicker";

interface StepComputedProps {
  template: Template;
  onChange: (next: Template) => void;
  onFormulaTest: (expr: string) => void;
}

function createComputed(): ComputedVar {
  const stamp = Date.now();
  return {
    key: `computed_${stamp}`,
    label: "Nuevo calculo",
    expr: "0"
  };
}

export default function StepComputed({ template, onChange, onFormulaTest }: StepComputedProps) {
  const dragItems = template.computed.map((item) => ({
    id: item.key,
    label: item.label,
    subtitle: item.expr
  }));

  function updateComputed(index: number, patch: Partial<ComputedVar>) {
    const next = [...template.computed];
    next[index] = { ...next[index], ...patch };
    onChange({ ...template, computed: next });
  }

  return (
    <section className="wizard-step">
      <header className="step-head">
        <h3>Paso 2 - Calculos</h3>
        <button type="button" onClick={() => onChange({ ...template, computed: [...template.computed, createComputed()] })}>
          + Agregar calculo
        </button>
      </header>

      <DragList
        title="Arrastra para ordenar calculos"
        items={dragItems}
        onReorder={(items) => {
          const byKey = new Map(template.computed.map((entry) => [entry.key, entry]));
          const next = items.map((item) => byKey.get(item.id)).filter(Boolean) as ComputedVar[];
          onChange({ ...template, computed: next });
        }}
      />

      <div className="editor-list">
        {template.computed.map((item, index) => (
          <article key={item.key} className="editor-card">
            <div className="row">
              <label>
                Clave
                <input value={item.key} onChange={(event) => updateComputed(index, { key: event.target.value })} />
              </label>
              <label>
                Etiqueta
                <input value={item.label} onChange={(event) => updateComputed(index, { label: event.target.value })} />
              </label>
              <label>
                Unidad
                <UnitPicker value={item.unit} onChange={(value) => updateComputed(index, { unit: value || undefined })} />
              </label>
              <button type="button" className="danger" onClick={() => onChange({ ...template, computed: template.computed.filter((_, idx) => idx !== index) })}>
                Eliminar
              </button>
            </div>
            <FormulaEditor
              label="Formula"
              value={item.expr}
              onChange={(expr) => updateComputed(index, { expr })}
              onTest={onFormulaTest}
            />
          </article>
        ))}
      </div>
    </section>
  );
}

