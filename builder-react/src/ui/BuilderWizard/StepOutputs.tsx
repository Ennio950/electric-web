import type { OutputLine, Template } from "../../../../engine/types";
import DragList from "../components/DragList";
import FormulaEditor from "../components/FormulaEditor";
import UnitPicker from "../components/UnitPicker";

interface StepOutputsProps {
  template: Template;
  onChange: (next: Template) => void;
  onFormulaTest: (expr: string) => void;
}

function createOutput(materialId = ""): OutputLine {
  const stamp = Date.now();
  return {
    id: `output_${stamp}`,
    materialId,
    qtyExpr: "0",
    unit: "unit",
    category: "materiales",
    applyWaste: false,
    applyPackaging: false,
    rounding: "round"
  };
}

export default function StepOutputs({ template, onChange, onFormulaTest }: StepOutputsProps) {
  const dragItems = template.outputs.map((output) => ({
    id: output.id,
    label: output.id,
    subtitle: output.qtyExpr
  }));

  function updateOutput(index: number, patch: Partial<OutputLine>) {
    const next = [...template.outputs];
    next[index] = { ...next[index], ...patch };
    onChange({ ...template, outputs: next });
  }

  return (
    <section className="wizard-step">
      <header className="step-head">
        <h3>Paso 4 - Salidas</h3>
        <button type="button" onClick={() => onChange({ ...template, outputs: [...template.outputs, createOutput(template.materials[0]?.id || "")] })}>
          + Agregar salida
        </button>
      </header>

      <DragList
        title="Arrastra para ordenar salidas"
        items={dragItems}
        onReorder={(items) => {
          const byId = new Map(template.outputs.map((entry) => [entry.id, entry]));
          const next = items.map((item) => byId.get(item.id)).filter(Boolean) as OutputLine[];
          onChange({ ...template, outputs: next });
        }}
      />

      <div className="editor-list">
        {template.outputs.map((output, index) => (
          <article key={output.id} className="editor-card">
            <div className="row">
              <label>
                ID de salida
                <input value={output.id} onChange={(event) => updateOutput(index, { id: event.target.value })} />
              </label>
              <label>
                Material
                <select value={output.materialId} onChange={(event) => updateOutput(index, { materialId: event.target.value })}>
                  <option value="">Seleccionar material</option>
                  {template.materials.map((material) => (
                    <option key={material.id} value={material.id}>{material.name} ({material.id})</option>
                  ))}
                </select>
              </label>
              <label>
                Unidad
                <UnitPicker value={output.unit} onChange={(value) => updateOutput(index, { unit: value || "unit" })} allowEmpty={false} />
              </label>
              <label>
                Categoria
                <select value={output.category} onChange={(event) => updateOutput(index, { category: event.target.value as OutputLine["category"] })}>
                  <option value="materiales">materiales</option>
                  <option value="mano_obra">mano_obra</option>
                  <option value="overhead">overhead</option>
                  <option value="contingencia">contingencia</option>
                  <option value="otros">otros</option>
                </select>
              </label>
            </div>

            <FormulaEditor
              label="Formula de cantidad"
              value={output.qtyExpr}
              onChange={(expr) => updateOutput(index, { qtyExpr: expr })}
              onTest={onFormulaTest}
            />

            <div className="row">
              <label>
                Aplicar merma
                <select value={String(Boolean(output.applyWaste))} onChange={(event) => updateOutput(index, { applyWaste: event.target.value === "true" })}>
                  <option value="false">false</option>
                  <option value="true">true</option>
                </select>
              </label>
              <label>
                Aplicar empaque
                <select value={String(Boolean(output.applyPackaging))} onChange={(event) => updateOutput(index, { applyPackaging: event.target.value === "true" })}>
                  <option value="false">false</option>
                  <option value="true">true</option>
                </select>
              </label>
              <label>
                Redondeo
                <select value={output.rounding || "round"} onChange={(event) => updateOutput(index, { rounding: event.target.value as OutputLine["rounding"] })}>
                  <option value="round">round</option>
                  <option value="ceil">ceil</option>
                  <option value="floor">floor</option>
                </select>
              </label>
              <button type="button" className="danger" onClick={() => onChange({ ...template, outputs: template.outputs.filter((_, idx) => idx !== index) })}>
                Eliminar
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

