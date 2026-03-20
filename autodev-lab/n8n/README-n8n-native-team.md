# Electric Web Copia Native AI Team

## Objetivo

Este flujo coordina tres agentes CLI para empujar la conversion de Electric Web Copia hacia una app nativa multi-OS:

- `DeepSeek Coder V2` en CPU por `ollama`
- `Codex CLI` para cambios seguros en backend, shared y data layer
- `Claude CLI` para cambios reales en rutas, componentes y theme movil

Al final ejecuta la validacion existente del pipeline native:

- `autodev-lab/n8n/mobile-native-build-runner.mjs convert`

## Archivos

Docker/Linux:

- `autodev-lab/n8n/electric-web-copia-native-ai-team.docker.json`

Windows host:

- `autodev-lab/n8n/electric-web-copia-native-ai-team.windows.json`

Runner comun:

- `autodev-lab/n8n/native-multi-agent-runner.mjs`
- `autodev-lab/n8n/start-native-ai-loop.cmd`
- `autodev-lab/n8n/stop-native-ai-loop.cmd`
- `autodev-lab/n8n/start-mobile-live-web.cmd`
- `autodev-lab/n8n/start-mobile-live-expo.cmd`
- `autodev-lab/n8n/watch-native-loop-status.cmd`
- `autodev-lab/n8n/watch-native-loop-output.cmd`

## Secuencia

El workflow corre estas fases:

1. `deepseek`
2. `codex`
3. `claude`
4. `convert`

Cada fase deja salida en:

- `autodev-lab/reports/n8n-native-team/`

## Perfiles del runner

```powershell
node autodev-lab/n8n/native-multi-agent-runner.mjs deepseek
node autodev-lab/n8n/native-multi-agent-runner.mjs codex
node autodev-lab/n8n/native-multi-agent-runner.mjs claude
node autodev-lab/n8n/native-multi-agent-runner.mjs convert
node autodev-lab/n8n/native-multi-agent-runner.mjs full
node autodev-lab/n8n/native-multi-agent-runner.mjs daemon
node autodev-lab/n8n/native-multi-agent-runner.mjs stop
node autodev-lab/n8n/native-multi-agent-runner.mjs status
```

Dry run:

```powershell
node autodev-lab/n8n/native-multi-agent-runner.mjs full --dry-run
```

## Requisitos

- `n8n` con `Execute Command` habilitado
- `codex` disponible dentro del entorno donde corre n8n
- `claude` disponible dentro del entorno donde corre n8n
- `ollama` apuntando al servicio CPU-only con `deepseek-coder-v2:16b`
- repo montado en el path esperado

Si usas el compose de este repo, la base ya queda preparada en:

- `autodev-lab/n8n/docker-compose.n8n.yml`
- `autodev-lab/n8n/Dockerfile.n8n-tools`

## Importacion recomendada

Si n8n corre en Docker:

- importa `electric-web-copia-native-ai-team.docker.json`

Si n8n corre como proceso normal en Windows:

- importa `electric-web-copia-native-ai-team.windows.json`
- importa `electric-web-copia-native-ai-loop-start.windows.json`
- importa `electric-web-copia-native-ai-loop-stop.windows.json`
- importa `electric-web-copia-native-ai-loop-status.windows.json`

## Notas

- El workflow queda inactivo por defecto.
- `DeepSeek` genera analisis.
- `Codex` aplica cambios en ownership tecnico.
- `Claude` aplica cambios en ownership visual y de rutas.
- La fase `convert` usa el runner native existente y dispara preview builds remotos solo si `EXPO_TOKEN` esta definido.
- Si `Claude CLI` no tiene sesion valida, la fase de implementacion queda registrada como fallo no bloqueante y el pipeline continua.
- El perfil `daemon` repite el ciclo indefinidamente hasta recibir una senal `stop`.
- El estado del bucle continuo queda en `autodev-lab/reports/n8n-native-team/continuous-state.json`.
- La senal de parada es ordenada: termina el paso actual y luego se detiene.
- Para ver la app con recarga en vivo en navegador usa `autodev-lab/n8n/start-mobile-live-web.cmd`.
- Para ver la app en Expo y abrir Android/iOS/web desde una sola terminal usa `autodev-lab/n8n/start-mobile-live-expo.cmd`.
- Para monitorear lo que va tocando el loop usa `autodev-lab/n8n/watch-native-loop-status.cmd`.
- Para seguir la salida textual del loop usa `autodev-lab/n8n/watch-native-loop-output.cmd`.
- Variables utiles:
- `N8N_NATIVE_LOOP_DELAY_MS`
- `N8N_NATIVE_LOOP_FAILURE_DELAY_MS`
