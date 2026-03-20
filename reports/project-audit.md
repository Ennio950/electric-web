# Project Audit

Fecha base: 20 de marzo de 2026.

## Hallazgos principales

- El repo es un monorepo Node/TypeScript con workspaces en `apps/*`, `packages/*`, `builder-react` y `straight-wire-backend`.
- La web legacy sigue activa en el root mediante archivos HTML como `index.html`, `panel-cliente.html`, `panel-empleado.html`, `panel-jefe.html`, `client-requests.html`, `emergency.html` y varias pantallas de estimaciones.
- Ya existe una app nativa en `apps/mobile` con Expo 55, React Native 0.83, Expo Router, React Query, Firebase y Zustand.
- La app movil ya cubre roles `client`, `employee`, `boss` y `builder` con rutas reales, por lo que no conviene regenerar una base movil nueva.
- Hay un laboratorio previo en `autodev-lab/` con un loop experimental, tareas JSON y un bootstrap para n8n. Se reutiliza como referencia, pero el workflow nuevo vive en `automation/`, `prompts/` y `scripts/`.

## Tecnologia movil elegida

Se prioriza React Native con Expo Router porque:

- ya existe una app funcional en `apps/mobile`,
- comparte TypeScript y contratos con `packages/*`,
- reduce riesgo frente a rehacer la migracion en otro stack,
- permite mantener una sola direccion para iOS, Android y web.

## Estado de la migracion hoy

- Base movil existente: si.
- Login y bootstrap nativo: si.
- Home screens por rol: si.
- Requests / emergency / queue / payments / builder: parcialmente migrados, con deuda de parity y endurecimiento.
- Pipeline multiagente persistente: creado en esta corrida.

## Riesgos detectados

- El proyecto no esta inicializado como repo `.git`, por lo que un revert automatico tras violaciones de ownership queda limitado.
- Existen archivos `.autodev.bak` en rutas moviles; esto sugiere trabajo previo asistido y necesidad de limpiar ownership con cuidado.
- La web legacy y la app movil comparten branding, flujos y contratos, pero no un sistema formal de ownership entre agentes hasta ahora.
- Hay assets compilados y directorios generados (`dist`, `dist-check*`, `.expo`, `android/build`) que deben quedar fuera del loop para no contaminar validaciones.

## Recomendacion

Usar el workflow multiagente nuevo para:

1. mantener Codex en capas de datos, backend, validacion e infraestructura,
2. mantener Claude en superficies UI/rutas/componentes,
3. mover cambios cruzados via handoff y locks,
4. seguir endureciendo `apps/mobile` en vez de crear otra app.
