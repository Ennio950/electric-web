# Electric Web Copia + n8n

## Idea correcta

La parte de tiempo no debe dominar el workflow.

La estructura correcta para este repo es:

- un workflow principal enfocado en `electric-web copia`,
- y un scheduler aparte, opcional, si despues quieres automatizarlo.

## Workflows

### 1. Workflow principal

Archivo Docker:

- `autodev-lab/n8n/mobile-native-multi-os-workflow.docker.json`

Nombre en n8n:

- `Electric Web Copia Native Converter`

Que hace:

- compila el repo,
- valida `apps/mobile`,
- exporta la base web de Expo,
- y si existe `EXPO_TOKEN`, dispara un preview build Android+iOS en EAS.

Uso recomendado:

- correrlo manualmente primero,
- revisar `Executions`,
- y solo despues pensar en automatizar horarios.

### 2. Scheduler opcional

Archivo Docker:

- `autodev-lab/n8n/electric-web-copia-native-scheduler.docker.json`

Nombre en n8n:

- `Electric Web Copia Native Scheduler (Optional)`

Que hace:

- solo lanza el workflow de conversion en un horario configurable.

La expresion inicial es diaria a las `02:15`, pero puedes cambiarla por cualquier cron o dejarlo desactivado.

## Perfil principal del runner

El runner ahora tiene un perfil `convert`.

Comando:

```powershell
node autodev-lab/n8n/mobile-native-build-runner.mjs convert
```

Si `EXPO_TOKEN` no existe:

- igual compila y exporta,
- pero omite el preview native build remoto.

## Requisitos reales

- `n8n self-hosted`
- `Execute Command` habilitado
- repo montado dentro del contenedor
- `EXPO_TOKEN` solo si quieres que EAS dispare builds nativos remotos

## Recomendacion practica

Primero usa solo:

- `Electric Web Copia Native Converter`

Cuando ya lo entiendas y te guste el resultado, activas aparte:

- `Electric Web Copia Native Scheduler (Optional)`
