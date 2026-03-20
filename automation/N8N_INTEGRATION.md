# Integracion opcional con n8n

## Contexto real de esta maquina

- El contenedor activo `autodev-n8n` tiene el proyecto montado en `/workspace/electric-web`.
- Tambien tiene montados `~/.codex` y `~/.claude`, por lo que puede invocar ambos CLIs desde el contenedor.
- Si lanzas `viewer` o `mobile preview` dentro del contenedor, necesitas exponer los puertos `4318` y `19006` para verlos desde Windows.

## Script recomendado

Desde host o desde `Execute Command` en n8n:

```bash
node /workspace/electric-web/scripts/start-n8n-stack.js
```

Modo dry-run:

```bash
node /workspace/electric-web/scripts/start-n8n-stack.js --dry
```

Opciones utiles:

- `--no-viewer`
- `--no-mobile`
- `--no-workflow`
- `--viewer-port 4318`
- `--mobile-port 19006`

El script arranca procesos desacoplados y escribe logs en:

- `automation/runtime/logs/n8n-viewer.out.log`
- `automation/runtime/logs/n8n-mobile.out.log`
- `automation/runtime/logs/n8n-workflow.out.log`

## Flujo sugerido en n8n

1. `Manual Trigger` o `Cron`.
2. `Execute Command`.
3. Comando:

```bash
node /workspace/electric-web/scripts/start-n8n-stack.js
```

4. Opcionalmente agregar un `HTTP Request` a `http://host.docker.internal:4318/api/health` para verificar que el viewer quedo arriba.

## Puertos y visibilidad

- Viewer esperado: `http://127.0.0.1:4318`
- Mobile preview esperado: `http://127.0.0.1:19006`

Si ejecutas todo desde el contenedor actual de n8n:

- `viewer` y `mobile preview` quedaran accesibles solo dentro del contenedor, a menos que publiques esos puertos.
- Para verlos desde Windows, puedes:
  - exponer `4318:4318` y `19006:19006` al recrear el contenedor, o
  - ejecutar `node scripts/start-n8n-stack.js` desde el host en lugar del contenedor.

## Stop y pausa

- Pausar workflow: crear `automation/PAUSE`
- Reanudar workflow: crear `automation/RESUME`
- Detener workflow: crear `automation/STOP`

Desde n8n puedes hacerlo con otro `Execute Command`, por ejemplo:

```bash
touch /workspace/electric-web/automation/STOP
```
