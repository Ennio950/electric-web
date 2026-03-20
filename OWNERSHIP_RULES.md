# Ownership Rules

## Estrategia aplicada

Se combina:

- module ownership,
- file ownership,
- lock files,
- handoff explicito.

## Codex owns

- `automation/`
- `scripts/`
- `apps/mobile/src/config`
- `apps/mobile/src/hooks`
- `apps/mobile/src/lib`
- `apps/mobile/src/providers`
- `apps/mobile/src/services`
- `apps/mobile/src/stores`
- `apps/mobile/src/types`
- `straight-wire-backend/`
- `packages/`
- `tests/`
- `e2e/`

## Claude owns

- `apps/mobile/app/`
- `apps/mobile/src/components/`
- `apps/mobile/src/theme/`
- `reports/` funcionales
- `mobile/`

## Politica de conflicto

- Si un task toca algo fuera de `allowedPaths`, falla.
- Si toca un path bloqueado por el otro agente, se registra incidente.
- Si necesita cruzar ownership, se crea handoff.
- Sin `.git`, no se garantiza revert automatico; la politica minima obligatoria es deteccion + incidente + bloqueo.
