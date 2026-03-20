import { useState } from "react";
import { parseExpression } from "@engine";

interface FormulaEditorProps {
  label: string;
  value: string;
  onChange: (next: string) => void;
  onTest?: (expr: string) => void;
}

export default function FormulaEditor({ label, value, onChange, onTest }: FormulaEditorProps) {
  const [error, setError] = useState<string>("");

  function validate(expr: string) {
    try {
      parseExpression(expr || "0");
      setError("");
      return true;
    } catch (validationError) {
      setError((validationError as Error).message || "Invalid expression");
      return false;
    }
  }

  return (
    <div className="formula-editor">
      <label>{label}</label>
      <textarea
        value={value}
        rows={2}
        onChange={(event) => {
          const next = event.target.value;
          onChange(next);
          validate(next);
        }}
        placeholder="Example: inputs.length * inputs.width"
      />
      <div className="formula-actions">
        <button
          type="button"
          onClick={() => {
            if (validate(value)) onTest?.(value);
          }}
        >
          Probar
        </button>
        {error ? <span className="formula-error">{error}</span> : <span className="formula-ok">Expr OK</span>}
      </div>
    </div>
  );
}

