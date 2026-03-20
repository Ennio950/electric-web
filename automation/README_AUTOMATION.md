# Automation README

## Objetivo

Esta carpeta contiene el workflow persistente para coordinar Codex CLI y Claude CLI sin que se pisen cambios.

## Archivos clave

- `tasks.json`: backlog persistente y cola de trabajo.
- `task-state.json`: estado agregado del workflow.
- `locks.json`: locks activos por task/path.
- `handoffs.json`: transferencias formales entre agentes.
- `checkpoints.json`: checkpoints de ejecucion.
- `STOP`, `PAUSE`, `RESUME`: banderas manuales de control.

## Flujo

1. `node scripts/loop-until-stopped.js --agent both`
2. El loop busca tareas `pending`.
3. Crea locks por `allowedPaths`.
4. Construye prompt contextual por agente.
5. Ejecuta `codex exec` o `claude -p`.
6. Captura snapshot antes/despues.
7. Valida ownership y registra incidentes si hubo invasion.
8. Actualiza estado y libera locks.

## Modos de workspace

- Modo live por defecto: ambos agentes trabajan sobre el repo actual y el viewer refleja cambios del mismo arbol en tiempo real.
- Bootstrap git live: `node scripts/bootstrap-agent-workspaces.js` inicializa git y deja ambos agentes sobre el repo actual.
- Modo aislado opcional: `node scripts/bootstrap-agent-workspaces.js --with-worktrees` crea workspaces dedicados para Codex y Claude en `automation/agent-workspaces.local.json`.
- El runtime ignora archivos internos del propio loop para que `change-events`, `locks`, `checkpoints` y reportes no contaminen la validacion de ownership.

## Control manual

- Crear `automation/STOP` para detener.
- Crear `automation/PAUSE` para pausar.
- Ejecutar `node scripts/resume-workflow.js --agent both` para reanudar.

## Comandos utiles

- `node scripts/validate-task.js --all`
- `node scripts/check-stop.js`
- `node scripts/run-codex-task.js --task codex-mobile-data-foundation --dry-run`
- `node scripts/run-claude-task.js --task claude-client-screens-parity --dry-run`
- `node scripts/loop-until-stopped.js --agent both --dry-run --max-cycles 1`
- `npm run workflow:bootstrap:git`
- `npm run workflow:bootstrap:workspaces`
