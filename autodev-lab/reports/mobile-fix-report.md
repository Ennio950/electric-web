# Mobile Fix Report

## Ejecucion
- Tarea: sample-task
- Modo: safe_fix
- Categoria fix: api-service-extraction
- Log: C:\Users\ennio\OneDrive\Desktop\electric-web copia\autodev-lab\logs\autodev-lab-engine-2026-03-15T02-15-45-017Z-26512.log

## Archivos Analizados
- `apps/mobile/app/(auth)/apply-employee.tsx`
- `apps/mobile/app/(auth)/magic-client.tsx`
- `apps/mobile/app/(auth)/signup-client.tsx`
- `apps/mobile/app/(boss)/admin/index.tsx`
- `apps/mobile/app/(boss)/index.tsx`
- `apps/mobile/app/(boss)/payments/[id].tsx`
- `apps/mobile/app/(boss)/payments/index.tsx`
- `apps/mobile/app/(boss)/queue/[id].tsx`
- `apps/mobile/app/(boss)/queue/index.tsx`
- `apps/mobile/app/(boss)/settings/index.tsx`
- `apps/mobile/app/(client)/emergency/[id].tsx`
- `apps/mobile/app/(client)/emergency/index.tsx`
- `apps/mobile/app/(client)/emergency/new.tsx`
- `apps/mobile/app/(client)/index.tsx`
- `apps/mobile/app/(client)/requests/[id].tsx`
- `apps/mobile/app/(client)/requests/index.tsx`
- `apps/mobile/app/(client)/requests/new.tsx`
- `apps/mobile/app/(employee)/emergency/[id].tsx`
- `apps/mobile/app/(employee)/emergency/new.tsx`
- `apps/mobile/app/(employee)/index.tsx`
- `apps/mobile/src/lib/imageUpload.ts`

## Hallazgos Detectados
- `fix-001` app/(auth)/apply-employee.tsx -> api_directa_repetida [manual]
- `fix-002` app/(auth)/magic-client.tsx -> api_directa_repetida [semiautomatico]
- `fix-003` app/(auth)/signup-client.tsx -> api_directa_repetida [semiautomatico]
- `fix-004` app/(boss)/admin/index.tsx -> api_directa_repetida [semiautomatico]
- `fix-005` app/(boss)/index.tsx -> api_directa_repetida [manual]
- `fix-006` app/(boss)/payments/[id].tsx -> api_directa_repetida [manual]
- `fix-007` app/(boss)/payments/index.tsx -> api_directa_repetida [semiautomatico]
- `fix-008` app/(boss)/queue/[id].tsx -> api_directa_repetida [manual]
- `fix-009` app/(boss)/queue/index.tsx -> api_directa_repetida [semiautomatico]
- `fix-010` app/(boss)/settings/index.tsx -> api_directa_repetida [manual]
- `fix-011` app/(client)/emergency/[id].tsx -> api_directa_repetida [semiautomatico]
- `fix-012` app/(client)/emergency/index.tsx -> api_directa_repetida [seguro_automatico]
- `fix-013` app/(client)/emergency/new.tsx -> api_directa_repetida [semiautomatico]
- `fix-014` app/(client)/index.tsx -> api_directa_repetida [semiautomatico]
- `fix-015` app/(client)/requests/[id].tsx -> api_directa_repetida [manual]
- `fix-016` app/(client)/requests/index.tsx -> api_directa_repetida [seguro_automatico]
- `fix-017` app/(client)/requests/new.tsx -> api_directa_repetida [semiautomatico]
- `fix-018` app/(employee)/emergency/[id].tsx -> api_directa_repetida [manual]
- `fix-019` app/(employee)/emergency/new.tsx -> api_directa_repetida [seguro_automatico]
- `fix-020` app/(employee)/index.tsx -> api_directa_repetida [semiautomatico]
- `fix-021` src/lib/imageUpload.ts -> fetch_directo [manual]

## Fixes Aplicados
- app/(client)/emergency/index.tsx -> import actualizado a loadClientEmergencyCalls()
- app/(client)/requests/index.tsx -> import actualizado a loadClientRequests()

## Archivos Modificados
- `apps/mobile/src/services/apiService.ts` (creado)
- `apps/mobile/app/(client)/emergency/index.tsx` (modificado)
- `apps/mobile/app/(client)/requests/index.tsx` (modificado)

## Backups Creados
- `apps/mobile/src/services/apiService.ts.autodev.bak`
- `apps/mobile/app/(client)/emergency/index.tsx.autodev.bak`
- `apps/mobile/app/(client)/requests/index.tsx.autodev.bak`

## Archivos Omitidos Por Seguridad
- app/(employee)/emergency/new.tsx -> Se excederia el limite de 3 archivos productivos por ejecucion.
- app/(auth)/apply-employee.tsx -> La pantalla supera el umbral seguro o no coincide con un patron soportado.
- app/(auth)/magic-client.tsx -> La pantalla requiere extraccion controlada, pero no coincide con un patron seguro exacto.
- app/(auth)/signup-client.tsx -> La pantalla requiere extraccion controlada, pero no coincide con un patron seguro exacto.
- app/(boss)/admin/index.tsx -> La pantalla requiere extraccion controlada, pero no coincide con un patron seguro exacto.
- app/(boss)/index.tsx -> La pantalla supera el umbral seguro o no coincide con un patron soportado.
- app/(boss)/payments/[id].tsx -> La pantalla supera el umbral seguro o no coincide con un patron soportado.
- app/(boss)/payments/index.tsx -> La pantalla requiere extraccion controlada, pero no coincide con un patron seguro exacto.
- app/(boss)/queue/[id].tsx -> La pantalla supera el umbral seguro o no coincide con un patron soportado.
- app/(boss)/queue/index.tsx -> La pantalla requiere extraccion controlada, pero no coincide con un patron seguro exacto.
- app/(boss)/settings/index.tsx -> La pantalla supera el umbral seguro o no coincide con un patron soportado.
- app/(client)/emergency/[id].tsx -> La pantalla requiere extraccion controlada, pero no coincide con un patron seguro exacto.
- app/(client)/emergency/new.tsx -> La pantalla requiere extraccion controlada, pero no coincide con un patron seguro exacto.
- app/(client)/index.tsx -> La pantalla requiere extraccion controlada, pero no coincide con un patron seguro exacto.
- app/(client)/requests/[id].tsx -> La pantalla supera el umbral seguro o no coincide con un patron soportado.
- app/(client)/requests/new.tsx -> La pantalla requiere extraccion controlada, pero no coincide con un patron seguro exacto.
- app/(employee)/emergency/[id].tsx -> La pantalla supera el umbral seguro o no coincide con un patron soportado.
- app/(employee)/index.tsx -> La pantalla requiere extraccion controlada, pero no coincide con un patron seguro exacto.
- src/lib/imageUpload.ts -> El fetch directo existe fuera del cliente API principal y no entra en el fix seguro de esta ejecucion.

## Validacion
- Resultado: ok
- archivos_modificados_existen: ok
- backups_creados: ok
- limite_archivos_productivos: ok (3/3)
- imports_validos: ok

## Siguientes Recomendaciones
- Extender el fixer a wrappers de requests y emergency adicionales solo cuando el patron siga siendo exacto y pequeno.
- Mantener el limite de archivos productivos por corrida para conservar reversibilidad.
- app/(auth)/apply-employee.tsx: extraer a src/services por feature antes de tocar la pantalla (manual)
- app/(auth)/magic-client.tsx: extraer a src/services por feature antes de tocar la pantalla (semiautomatico)
- app/(auth)/signup-client.tsx: extraer a src/services por feature antes de tocar la pantalla (semiautomatico)
- app/(boss)/admin/index.tsx: extraer a src/services por feature antes de tocar la pantalla (semiautomatico)
- app/(boss)/index.tsx: extraer a src/services por feature antes de tocar la pantalla (manual)
- app/(boss)/payments/[id].tsx: extraer a src/services por feature antes de tocar la pantalla (manual)
- app/(boss)/payments/index.tsx: extraer a src/services por feature antes de tocar la pantalla (semiautomatico)
- app/(boss)/queue/[id].tsx: extraer a src/services por feature antes de tocar la pantalla (manual)
- app/(boss)/queue/index.tsx: extraer a src/services por feature antes de tocar la pantalla (semiautomatico)
- app/(boss)/settings/index.tsx: extraer a src/services por feature antes de tocar la pantalla (manual)

## Resumen
- Hallazgos encontrados: 21
- Fixes seguros aplicados: 2
- Archivos modificados: 3
- Archivos omitidos: 19
- Backlog JSON: C:\Users\ennio\OneDrive\Desktop\electric-web copia\autodev-lab\reports\mobile-fix-backlog.json

