# AGENTS WORKFLOW

## Agentes

- Codex CLI: owner de automation, scripts, backend, contratos, stores, hooks, services y validacion.
- Claude CLI: owner de rutas moviles, componentes, theme, documentacion funcional y parity visual.

## Reglas

- Ningun agente toca archivos fuera de `allowedPaths`.
- Ningun agente toca paths bloqueados por el otro.
- Todo cruce de ownership va por `handoff`.
- El loop siempre valida cambios tocados despues de cada corrida.
- `--agent both` ejecuta ambos agentes en paralelo real.
- Si existe `automation/agent-workspaces.local.json`, cada agente puede usar su propio workspace.

## Ejecucion

- `node scripts/loop-until-stopped.js --agent codex`
- `node scripts/loop-until-stopped.js --agent claude`
- `node scripts/loop-until-stopped.js --agent both`
- `node scripts/bootstrap-agent-workspaces.js`

## Handoff

Si un agente necesita otro modulo:

1. no edita fuera de ownership,
2. crea handoff con `node scripts/create-handoff.js`,
3. deja la tarea original consistente,
4. espera a que el otro agente tome el borde.
