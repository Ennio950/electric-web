import type { ProjectionResult } from "../../../../engine/types";

interface AuditPreviewProps {
  result: ProjectionResult | null;
}

export default function AuditPreview({ result }: AuditPreviewProps) {
  if (!result) {
    return (
      <section className="preview-card">
        <h3>Auditoria</h3>
        <p className="muted">Aun no hay eventos de auditoria.</p>
      </section>
    );
  }

  return (
    <section className="preview-card">
      <header className="preview-head">
        <h3>Auditoria</h3>
        <span className={`precision-chip precision-${result.precisionScore}`}>Precision: {result.precisionScore}</span>
      </header>

      {result.warnings.length > 0 ? (
        <div className="warning-box">
          <strong>Alertas</strong>
          <ul>
            {result.warnings.map((warning, idx) => (
              <li key={`w-${idx}`}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {result.assumptions.length > 0 ? (
        <div className="warning-box assumptions">
          <strong>Supuestos</strong>
          <ul>
            {result.assumptions.map((warning, idx) => (
              <li key={`a-${idx}`}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="audit-scroll">
        {result.audit.map((entry, idx) => (
          <article key={`${entry.ts}-${idx}`} className={`audit-item lvl-${entry.level}`}>
            <div className="audit-row">
              <strong>{entry.stage}</strong>
              <time>{new Date(entry.ts).toLocaleTimeString()}</time>
            </div>
            <p>{entry.message}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

