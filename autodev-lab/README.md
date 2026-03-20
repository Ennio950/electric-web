# AutoDev Lab

AutoDev Lab es un laboratorio interno para bootstrapear un motor AutoDev sin tocar el codigo principal de Electric Web. En este PASO 2 el motor vive solo dentro de `autodev-lab/` y esta orientado a analizar, planificar y extender la aplicacion movil basada en React Native con Expo.

## Estructura

```text
autodev-lab/
  engine/
    agents/
    config/
    core/
    tasks/
  logs/
  reports/
  scripts/
  tasks/
```

## Componentes

- `engine/index.js`: punto de entrada del motor y ensamblado de dependencias.
- `engine/core/taskManager.js`: persistencia JSON de tareas y control de estados.
- `engine/core/loopRunner.js`: ciclo AutoDev con fases placeholder.
- `engine/core/logger.js`: logs en consola y archivos timestamped.
- `engine/core/reporter.js`: reportes markdown por ejecucion.
- `engine/agents/*.agent.js`: placeholders listos para futuras integraciones con Claude, Codex y OpenClaw.

## Crear una tarea

```bash
node autodev-lab/scripts/create-task.js --titulo "Auditar navegacion mobile"
```

Opciones utiles:

- `--descripcion`
- `--modulo`
- `--areaObjetivo`
- `--plataformaObjetivo`
- `--aplicacionObjetivo`
- `--modo`

Las tareas nuevas se guardan en `autodev-lab/tasks/`.

## Ejecutar una tarea

Ejecutar la tarea de ejemplo por ID:

```bash
node autodev-lab/scripts/run-task.js --task sample-task
```

Ejecutar una tarea por ruta:

```bash
node autodev-lab/scripts/run-task.js autodev-lab/tasks/sample-task.json
```

El `loopRunner` realiza este flujo:

1. Carga la tarea.
2. Ejecuta `analisis`.
3. Ejecuta `planificacion`.
4. Ejecuta `implementacion`.
5. Ejecuta `validacion`.
6. Genera el `reporte`.

Los resultados quedan en:

- `autodev-lab/logs/`
- `autodev-lab/reports/`

## Integracion con Electric Web

Este bootstrap no modifica `apps/mobile/` ni ningun otro paquete del monorepo. La integracion actual es por referencia de rutas y metadata de tareas, lo que deja la base lista para conectar mas adelante:

- n8n para orquestacion.
- OpenClaw para inspeccion local y ejecucion controlada.
- Codex y Claude para planificacion, implementacion y revision.
- Ollama para ejecucion local de modelos.
- WhatsApp como canal de control operativo.

## Alcance actual

El motor actual es una primera version funcional. Las fases usan placeholders y registran eventos, pero ya existe el contrato basico para:

- crear tareas en JSON,
- ejecutar un ciclo AutoDev,
- persistir estado,
- generar logs,
- generar reportes por corrida.

## Integracion con n8n

El laboratorio ya incluye un bootstrap inicial para n8n orientado a ejecutar el backlog seguro de AutoDev sin depender todavia de credenciales ni de integraciones externas.

Artefactos disponibles:

- `autodev-lab/n8n/autodev-next-safe-workflow.json`: workflow importable llamado `AutoDev Next Safe Runner`.
- `autodev-lab/n8n/autodev-runner.ps1`: script PowerShell auxiliar para correr `--next-safe` y luego `list-tasks`.
- `autodev-lab/n8n/docker-compose.n8n.yml`: compose de ejemplo para levantar n8n con `N8N_ENABLE_EXECUTE_COMMAND=true`.
- `autodev-lab/n8n/README-n8n-autodev.md`: documentacion de importacion, activacion y pruebas.
- `autodev-lab/n8n/docker-notes.md`: notas operativas para despliegues de n8n dentro de Docker.

Proposito:

- programar ejecuciones seguras de AutoDev,
- correr una sola tarea segura por corrida,
- dejar trazabilidad en `autodev-lab/logs/` y `autodev-lab/reports/`,
- preparar el terreno para aprobaciones y notificaciones futuras.

Limitaciones actuales:

- no hay credenciales configuradas,
- no hay notificaciones automaticas,
- no hay control remoto todavia,
- el workflow depende de que `Execute Command` este habilitado en n8n,
- el workflow JSON usa una ruta Windows fija y puede requerir ajuste si n8n corre en otro host o en Docker.

Siguiente paso recomendado:

- agregar notificaciones,
- agregar control remoto o aprobacion manual,
- versionar variantes del workflow para host Windows y contenedor Docker.
