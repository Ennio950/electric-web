import type { ProjectionResult } from "../../../../engine/types";

interface BomPreviewProps {
  result: ProjectionResult | null;
}

export default function BomPreview({ result }: BomPreviewProps) {
  if (!result) {
    return (
      <section className="preview-card">
        <h3>Resumen de materiales</h3>
        <p className="muted">Todavia no hay proyeccion.</p>
      </section>
    );
  }

  return (
    <section className="preview-card">
      <h3>Resumen de materiales</h3>
      <div className="table-scroll">
        <table className="preview-table">
          <thead>
            <tr>
              <th>Material</th>
              <th>Categoria</th>
              <th>Cantidad</th>
              <th>Costo unitario</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {result.lines.map((line) => (
              <tr key={line.id}>
                <td>{line.materialName}</td>
                <td>{line.category}</td>
                <td>{line.qty.toFixed(4)} {line.unit}</td>
                <td>{line.unitCost.toFixed(4)}</td>
                <td>{line.lineTotal.toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="totals-grid">
        <span>Materiales: {result.totals.materiales.toFixed(2)}</span>
        <span>Mano obra: {result.totals.mano_obra.toFixed(2)}</span>
        <span>Overhead: {result.totals.overhead.toFixed(2)}</span>
        <span>Contingencia: {result.totals.contingencia.toFixed(2)}</span>
        <span>Otros: {result.totals.otros.toFixed(2)}</span>
        <strong>Total: {result.totals.grandTotal.toFixed(2)}</strong>
      </div>
    </section>
  );
}

