# README Mobile Migration

## Stack elegido

React Native con Expo Router sobre la app existente en `apps/mobile`.

## Por que esta tecnologia

- Ya esta implementada en el repo.
- Comparte TypeScript y dominio con `packages/*`.
- Tiene rutas reales para auth, client, employee, boss y builder.
- Reduce el riesgo de abrir una segunda migracion paralela.

## Estrategia

1. Mantener la web legacy estable.
2. Endurecer contratos y stores con Codex.
3. Completar parity de pantallas y branding con Claude.
4. Validar ownership despues de cada task.
5. Usar handoffs para cambios cruzados.

## Meta operativa

Cerrar la brecha entre las pantallas HTML legacy y las rutas moviles existentes hasta lograr una app usable en iOS y Android sin perder branding ni flujos actuales.
