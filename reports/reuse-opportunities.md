# Reuse Opportunities

## Reutilizacion directa

- `apps/mobile` ya contiene la base nativa y debe seguir siendo el target principal.
- `packages/builder-domain` y `packages/estimator-core` son la mejor via para compartir logica entre web, builder y mobile.
- `straight-wire-backend` ya centraliza contratos, autenticacion y cookies del portal; puede evolucionar hacia endpoints mas moviles sin rehacer dominio.
- `assets/js/company-config.js` y el branding actual dan el lenguaje visual y textual que la app debe conservar.

## Reutilizacion parcial

- Los HTML legacy sirven como mapa de flujos, microcopys y jerarquia visual.
- Los CSS legacy sirven como referencia de branding, no como implementacion directa en React Native.
- `autodev-lab/` aporta convenciones previas y bootstrap n8n, pero el nuevo workflow vive en carpetas separadas para no acoplarse al experimento anterior.

## Oportunidades de handoff

- Claude puede avanzar pantallas usando componentes y theme, mientras Codex estabiliza stores, servicios y backend.
- Cuando una pantalla necesite un nuevo contrato o selector, Claude debe crear handoff hacia Codex en vez de editar capas de datos.
- Cuando Codex cierre un cambio de API o estado, puede devolver handoff a Claude para terminar parity visual y UX.
