import type { Template } from "../../../engine/types";

interface TemplateListProps {
  templates: Template[];
  selectedTemplateId: string;
  onSelect: (templateId: string) => void;
  onCreate: () => void;
  onDuplicate: (templateId: string) => void;
  onDelete: (templateId: string) => void;
  onRename: (templateId: string, name: string) => void;
}

export default function TemplateList({
  templates,
  selectedTemplateId,
  onSelect,
  onCreate,
  onDuplicate,
  onDelete,
  onRename
}: TemplateListProps) {
  return (
    <section className="templates-panel">
      <header className="templates-head">
        <h2>Plantillas</h2>
        <button type="button" onClick={onCreate}>+ Nueva</button>
      </header>

      <div className="templates-list">
        {templates.length === 0 ? <p className="muted">Aun no hay plantillas.</p> : null}
        {templates.map((template) => (
          <article
            key={template.id}
            className={`template-item ${selectedTemplateId === template.id ? "active" : ""}`}
          >
            <button type="button" className="template-select" onClick={() => onSelect(template.id)}>
              <strong>{template.name}</strong>
              <small>{template.id}</small>
              <small>v{template.version}</small>
            </button>

            <div className="template-actions">
              <button type="button" onClick={() => onDuplicate(template.id)}>Duplicar</button>
              <button
                type="button"
                onClick={() => {
                  const nextName = window.prompt("Renombrar plantilla", template.name);
                  if (!nextName) return;
                  onRename(template.id, nextName);
                }}
              >
                Renombrar
              </button>
              <button type="button" className="danger" onClick={() => onDelete(template.id)}>Eliminar</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

