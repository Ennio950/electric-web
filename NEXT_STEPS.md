# Next Steps

## Backlog inmediato

1. Ejecutar `codex-mobile-data-foundation` para estabilizar stores, hooks y servicios.
2. Ejecutar `claude-auth-and-entry-screens` para cerrar parity de auth.
3. Ejecutar `claude-client-screens-parity`.
4. Ejecutar `claude-employee-screens-parity`.
5. Ejecutar `claude-boss-and-builder-surfaces`.
6. Ejecutar `codex-backend-mobile-contracts`.
7. Cerrar con `codex-validation-pipeline`.

## Operacion sugerida

- Primera corrida: `node scripts/loop-until-stopped.js --agent both --dry-run --max-cycles 1`
- Segunda corrida: quitar `--dry-run` y dejar que Codex/Claude tomen backlog real.

## Limitaciones actuales

- El repo no tiene `.git`.
- El workflow ya detecta ownership y conflictos, pero el revert automatico no es confiable sin control de versiones.
- Varias pantallas moviles ya existen; el foco ahora es parity, contratos y limpieza, no bootstrap.
