import type { Rule, RuleAction, Template } from "../../../../engine/types";
import FormulaEditor from "../components/FormulaEditor";

interface StepRulesProps {
  template: Template;
  onChange: (next: Template) => void;
  onFormulaTest: (expr: string) => void;
}

function createRule(): Rule {
  const stamp = Date.now();
  return {
    id: `rule_${stamp}`,
    when: "true",
    actions: [{ kind: "addWarning", message: "Regla activada" }]
  };
}

function createAction(kind: RuleAction["kind"]): RuleAction {
  if (kind === "showField") return { kind, key: "" };
  if (kind === "hideField") return { kind, key: "" };
  if (kind === "overrideComputed") return { kind, key: "", expr: "0" };
  if (kind === "multiplyOutput") return { kind, outputId: "", factor: 1 };
  return { kind: "addWarning", message: "Advertencia de regla" };
}

export default function StepRules({ template, onChange, onFormulaTest }: StepRulesProps) {
  function updateRule(index: number, patch: Partial<Rule>) {
    const nextRules = [...template.rules];
    nextRules[index] = { ...nextRules[index], ...patch };
    onChange({ ...template, rules: nextRules });
  }

  function updateAction(ruleIndex: number, actionIndex: number, patch: Partial<RuleAction>) {
    const nextRules = [...template.rules];
    const actions = [...nextRules[ruleIndex].actions];
    actions[actionIndex] = { ...actions[actionIndex], ...patch } as RuleAction;
    nextRules[ruleIndex] = { ...nextRules[ruleIndex], actions };
    onChange({ ...template, rules: nextRules });
  }

  return (
    <section className="wizard-step">
      <header className="step-head">
        <h3>Paso 5 - Reglas</h3>
        <button type="button" onClick={() => onChange({ ...template, rules: [...template.rules, createRule()] })}>
          + Agregar regla
        </button>
      </header>

      <div className="editor-list">
        {template.rules.map((rule, ruleIndex) => (
          <article key={rule.id} className="editor-card">
            <div className="row">
              <label>
                ID de regla
                <input value={rule.id} onChange={(event) => updateRule(ruleIndex, { id: event.target.value })} />
              </label>
              <button
                type="button"
                className="danger"
                onClick={() => onChange({ ...template, rules: template.rules.filter((_, idx) => idx !== ruleIndex) })}
              >
                Eliminar regla
              </button>
            </div>

            <FormulaEditor
              label="Condicion (formula booleana)"
              value={rule.when}
              onChange={(expr) => updateRule(ruleIndex, { when: expr })}
              onTest={onFormulaTest}
            />

            <div className="action-list">
              {rule.actions.map((action, actionIndex) => (
                <div key={`${rule.id}-${actionIndex}`} className="action-row">
                  <label>
                    Tipo
                    <select
                      value={action.kind}
                      onChange={(event) => {
                        const kind = event.target.value as RuleAction["kind"];
                        const nextAction = createAction(kind);
                        updateAction(ruleIndex, actionIndex, nextAction);
                      }}
                    >
                      <option value="showField">showField</option>
                      <option value="hideField">hideField</option>
                      <option value="overrideComputed">overrideComputed</option>
                      <option value="multiplyOutput">multiplyOutput</option>
                      <option value="addWarning">addWarning</option>
                    </select>
                  </label>

                  {action.kind === "showField" || action.kind === "hideField" ? (
                    <label>
                      Clave del campo
                      <input
                        value={action.key}
                        onChange={(event) => updateAction(ruleIndex, actionIndex, { key: event.target.value })}
                      />
                    </label>
                  ) : null}

                  {action.kind === "overrideComputed" ? (
                    <>
                      <label>
                        Clave de calculo
                        <input value={action.key} onChange={(event) => updateAction(ruleIndex, actionIndex, { key: event.target.value })} />
                      </label>
                      <label>
                        Formula
                        <input value={action.expr} onChange={(event) => updateAction(ruleIndex, actionIndex, { expr: event.target.value })} />
                      </label>
                    </>
                  ) : null}

                  {action.kind === "multiplyOutput" ? (
                    <>
                      <label>
                        ID de salida
                        <input value={action.outputId} onChange={(event) => updateAction(ruleIndex, actionIndex, { outputId: event.target.value })} />
                      </label>
                      <label>
                        Factor
                        <input
                          type="number"
                          value={action.factor}
                          onChange={(event) => updateAction(ruleIndex, actionIndex, { factor: Number(event.target.value) })}
                        />
                      </label>
                    </>
                  ) : null}

                  {action.kind === "addWarning" ? (
                    <label className="wide">
                      Mensaje
                      <input value={action.message} onChange={(event) => updateAction(ruleIndex, actionIndex, { message: event.target.value })} />
                    </label>
                  ) : null}

                  <button
                    type="button"
                    className="danger"
                    onClick={() => {
                      const nextRules = [...template.rules];
                      const actions = nextRules[ruleIndex].actions.filter((_, idx) => idx !== actionIndex);
                      nextRules[ruleIndex] = { ...nextRules[ruleIndex], actions };
                      onChange({ ...template, rules: nextRules });
                    }}
                  >
                    Eliminar accion
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                const nextRules = [...template.rules];
                nextRules[ruleIndex] = {
                  ...nextRules[ruleIndex],
                  actions: [...nextRules[ruleIndex].actions, createAction("addWarning")]
                };
                onChange({ ...template, rules: nextRules });
              }}
            >
              + Agregar accion
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

