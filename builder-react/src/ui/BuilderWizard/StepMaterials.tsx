import type { Material, Template } from "../../../../engine/types";
import DragList from "../components/DragList";
import UnitPicker from "../components/UnitPicker";

interface StepMaterialsProps {
  template: Template;
  onChange: (next: Template) => void;
}

function createMaterial(): Material {
  const stamp = Date.now();
  return {
    id: `mat_${stamp}`,
    name: "Nuevo material",
    baseUnit: "unit",
    unitCost: 0,
    wastePct: 0,
    rounding: "round"
  };
}

export default function StepMaterials({ template, onChange }: StepMaterialsProps) {
  const dragItems = template.materials.map((material) => ({
    id: material.id,
    label: material.name,
    subtitle: `${material.baseUnit} | ${material.unitCost ?? 0}`
  }));

  function updateMaterial(index: number, patch: Partial<Material>) {
    const next = [...template.materials];
    next[index] = { ...next[index], ...patch };
    onChange({ ...template, materials: next });
  }

  return (
    <section className="wizard-step">
      <header className="step-head">
        <h3>Paso 3 - Materiales</h3>
        <button type="button" onClick={() => onChange({ ...template, materials: [...template.materials, createMaterial()] })}>
          + Agregar material
        </button>
      </header>

      <DragList
        title="Arrastra para ordenar materiales"
        items={dragItems}
        onReorder={(items) => {
          const byId = new Map(template.materials.map((entry) => [entry.id, entry]));
          const next = items.map((item) => byId.get(item.id)).filter(Boolean) as Material[];
          onChange({ ...template, materials: next });
        }}
      />

      <div className="editor-list">
        {template.materials.map((material, index) => (
          <article key={material.id} className="editor-card">
            <div className="row">
              <label>
                ID
                <input value={material.id} onChange={(event) => updateMaterial(index, { id: event.target.value })} />
              </label>
              <label>
                Nombre
                <input value={material.name} onChange={(event) => updateMaterial(index, { name: event.target.value })} />
              </label>
              <label>
                SKU
                <input value={material.sku || ""} onChange={(event) => updateMaterial(index, { sku: event.target.value || undefined })} />
              </label>
              <label>
                Unidad base
                <UnitPicker value={material.baseUnit} onChange={(value) => updateMaterial(index, { baseUnit: value || "unit" })} allowEmpty={false} />
              </label>
            </div>

            <div className="row">
              <label>
                Costo unitario
                <input type="number" value={material.unitCost ?? 0} onChange={(event) => updateMaterial(index, { unitCost: Number(event.target.value) })} />
              </label>
              <label>
                Merma %
                <input type="number" value={material.wastePct ?? 0} onChange={(event) => updateMaterial(index, { wastePct: Number(event.target.value) })} />
              </label>
              <label>
                Tamano de paquete
                <input
                  type="number"
                  value={material.packaging?.packSize ?? ""}
                  onChange={(event) => {
                    const packSize = Number(event.target.value);
                    updateMaterial(index, {
                      packaging: {
                        packSize,
                        packUnit: material.packaging?.packUnit || material.baseUnit
                      }
                    });
                  }}
                />
              </label>
              <label>
                Unidad del paquete
                <UnitPicker
                  value={material.packaging?.packUnit || material.baseUnit}
                  onChange={(value) =>
                    updateMaterial(index, {
                      packaging: {
                        packSize: material.packaging?.packSize || 1,
                        packUnit: value || material.baseUnit
                      }
                    })
                  }
                />
              </label>
            </div>

            <div className="row">
              <label>
                Redondeo
                <select value={material.rounding || "round"} onChange={(event) => updateMaterial(index, { rounding: event.target.value as Material["rounding"] })}>
                  <option value="round">round</option>
                  <option value="ceil">ceil</option>
                  <option value="floor">floor</option>
                </select>
              </label>
              <button type="button" className="danger" onClick={() => onChange({ ...template, materials: template.materials.filter((_, idx) => idx !== index) })}>
                Eliminar
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

