# Mobile Inspection

## Resumen
- Aplicacion objetivo: apps/mobile
- Plataforma objetivo: react-native-expo
- Modo: SAFE_AUTODEV_EXECUTABLE_BACKLOG_MOBILE_BACKEND
- Pantallas detectadas: 30
- Layouts detectados: 6
- Grupos de rutas detectados: auth, boss, builder, client, employee
- Hooks distintos detectados: 18
- Ocurrencias totales de hooks: 525
- Llamadas API detectadas: 29

## Estructura Completa de Rutas Expo Router
- `/`
  - Grupo `(auth)`
    - `/(auth)/apply-employee` -> `(auth)/apply-employee.tsx` ( estatica)
    - `/(auth)/login` -> `(auth)/login.tsx` ( estatica)
    - `/(auth)/magic-client` -> `(auth)/magic-client.tsx` ( estatica)
    - `/(auth)/signup-client` -> `(auth)/signup-client.tsx` ( estatica)
  - Grupo `(boss)`
    - `/(boss)` -> `(boss)/index.tsx` ( estatica)
    - `/(boss)/admin` -> `(boss)/admin/index.tsx` ( estatica)
    - `/(boss)/payments` -> `(boss)/payments/index.tsx` ( estatica)
    - `/(boss)/payments/[id]` -> `(boss)/payments/[id].tsx` ( dinamica)
    - `/(boss)/queue` -> `(boss)/queue/index.tsx` ( estatica)
    - `/(boss)/queue/[id]` -> `(boss)/queue/[id].tsx` ( dinamica)
    - `/(boss)/settings` -> `(boss)/settings/index.tsx` ( estatica)
  - Grupo `(builder)`
    - `/(builder)` -> `(builder)/index.tsx` ( estatica)
    - `/(builder)/jobs/[id]` -> `(builder)/jobs/[id].tsx` ( dinamica)
    - `/(builder)/materials` -> `(builder)/materials.tsx` ( estatica)
    - `/(builder)/recipes` -> `(builder)/recipes.tsx` ( estatica)
  - Grupo `(client)`
    - `/(client)` -> `(client)/index.tsx` ( estatica)
    - `/(client)/emergency` -> `(client)/emergency/index.tsx` ( estatica)
    - `/(client)/emergency/[id]` -> `(client)/emergency/[id].tsx` ( dinamica)
    - `/(client)/emergency/new` -> `(client)/emergency/new.tsx` ( estatica)
    - `/(client)/requests` -> `(client)/requests/index.tsx` ( estatica)
    - `/(client)/requests/[id]` -> `(client)/requests/[id].tsx` ( dinamica)
    - `/(client)/requests/new` -> `(client)/requests/new.tsx` ( estatica)
  - Grupo `(employee)`
    - `/(employee)` -> `(employee)/index.tsx` ( estatica)
    - `/(employee)/emergency/[id]` -> `(employee)/emergency/[id].tsx` ( dinamica)
    - `/(employee)/emergency/new` -> `(employee)/emergency/new.tsx` ( estatica)
    - `/(employee)/profile` -> `(employee)/profile/index.tsx` ( estatica)
    - `/(employee)/requests` -> `(employee)/requests/index.tsx` ( estatica)
    - `/(employee)/requests/[id]` -> `(employee)/requests/[id].tsx` ( dinamica)
  - Rutas sin grupo
    - `/` -> `index.tsx`
    - `/+not-found` -> `+not-found.tsx`

## Lista de Pantallas Detectadas
- `/` -> `index.tsx` (27 lineas, hooks: useSessionSnapshot)
- `/(auth)/apply-employee` -> `(auth)/apply-employee.tsx` (491 lineas, hooks: useEffect, useMutation, useSessionStore, useState)
- `/(auth)/login` -> `(auth)/login.tsx` (243 lineas, hooks: useSessionSnapshot, useSessionStore, useState)
- `/(auth)/magic-client` -> `(auth)/magic-client.tsx` (267 lineas, hooks: useEffect, useMutation, useSessionStore, useState)
- `/(auth)/signup-client` -> `(auth)/signup-client.tsx` (325 lineas, hooks: useEffect, useMutation, useSessionStore, useState)
- `/(boss)` -> `(boss)/index.tsx` (402 lineas, hooks: useMobileHomeQuery, useQuery, useSessionStore)
- `/(boss)/admin` -> `(boss)/admin/index.tsx` (333 lineas, hooks: useMemo, useMutation, useQuery, useQueryClient, useSessionStore)
- `/(boss)/payments` -> `(boss)/payments/index.tsx` (173 lineas, hooks: useQuery, useSessionStore, useState)
- `/(boss)/payments/[id]` -> `(boss)/payments/[id].tsx` (371 lineas, hooks: useLocalSearchParams, useMutation, useQuery, useQueryClient, useSessionStore, useState)
- `/(boss)/queue` -> `(boss)/queue/index.tsx` (263 lineas, hooks: useQuery, useSessionStore, useState)
- `/(boss)/queue/[id]` -> `(boss)/queue/[id].tsx` (367 lineas, hooks: useLocalSearchParams, useMutation, useQuery, useQueryClient, useSessionStore)
- `/(boss)/settings` -> `(boss)/settings/index.tsx` (404 lineas, hooks: useEffect, useMutation, useQuery, useQueryClient, useSessionStore, useState)
- `/(builder)` -> `(builder)/index.tsx` (277 lineas, hooks: useBuilderStore, useCurrentBuilderJob, useSessionStore, useState)
- `/(builder)/jobs/[id]` -> `(builder)/jobs/[id].tsx` (707 lineas, hooks: useBuilderStore, useCurrentBuilderJob, useEffect, useLocalSearchParams, useMemo, useRouter, useSelectedBuilderComponent, useSessionStore, useState)
- `/(builder)/materials` -> `(builder)/materials.tsx` (186 lineas, hooks: useBuilderStore, useSessionStore, useState)
- `/(builder)/recipes` -> `(builder)/recipes.tsx` (172 lineas, hooks: useBuilderStore, useState)
- `/(client)` -> `(client)/index.tsx` (137 lineas, hooks: useMobileHomeQuery, useQuery, useSessionStore)
- `/(client)/emergency` -> `(client)/emergency/index.tsx` (191 lineas, hooks: useMemo, useQuery, useSessionStore, useState)
- `/(client)/emergency/[id]` -> `(client)/emergency/[id].tsx` (290 lineas, hooks: useLocalSearchParams, useMemo, useMutation, useQuery, useQueryClient, useSessionStore, useState)
- `/(client)/emergency/new` -> `(client)/emergency/new.tsx` (198 lineas, hooks: useMemo, useMutation, useQueryClient, useSessionStore, useState)
- `/(client)/requests` -> `(client)/requests/index.tsx` (190 lineas, hooks: useMemo, useQuery, useSessionStore, useState)
- `/(client)/requests/[id]` -> `(client)/requests/[id].tsx` (458 lineas, hooks: useLocalSearchParams, useMemo, useMutation, useQuery, useQueryClient, useSessionStore, useState)
- `/(client)/requests/new` -> `(client)/requests/new.tsx` (195 lineas, hooks: useMemo, useMutation, useQueryClient, useSessionStore, useState)
- `/(employee)` -> `(employee)/index.tsx` (298 lineas, hooks: useMobileHomeQuery, useQuery, useSessionStore)
- `/(employee)/emergency/[id]` -> `(employee)/emergency/[id].tsx` (465 lineas, hooks: useLocalSearchParams, useMutation, useQuery, useQueryClient, useSessionStore, useState)
- `/(employee)/emergency/new` -> `(employee)/emergency/new.tsx` (211 lineas, hooks: useQuery, useSessionStore, useState)
- `/(employee)/profile` -> `(employee)/profile/index.tsx` (406 lineas, hooks: useEffect, useMemo, useMutation, useQuery, useQueryClient, useSessionStore, useState)
- `/(employee)/requests` -> `(employee)/requests/index.tsx` (229 lineas, hooks: useQuery, useSessionStore, useState)
- `/(employee)/requests/[id]` -> `(employee)/requests/[id].tsx` (465 lineas, hooks: useLocalSearchParams, useMutation, useQuery, useQueryClient, useSessionStore, useState)
- `/+not-found` -> `+not-found.tsx` (34 lineas, hooks: ninguno)

## Grupos de Rutas
- `(auth)`
- `(boss)`
- `(builder)`
- `(client)`
- `(employee)`

## Layouts Encontrados
- `_layout.tsx` -> `/`
- `(auth)/_layout.tsx` -> `/(auth)`
- `(boss)/_layout.tsx` -> `/(boss)`
- `(builder)/_layout.tsx` -> `/(builder)`
- `(client)/_layout.tsx` -> `/(client)`
- `(employee)/_layout.tsx` -> `/(employee)`

## Hooks Detectados
- `useState` en 24 archivos (131 ocurrencias)
- `useSessionStore` en 35 archivos (91 ocurrencias)
- `useMutation` en 15 archivos (70 ocurrencias)
- `useQuery` en 20 archivos (56 ocurrencias)
- `useBuilderStore` en 5 archivos (43 ocurrencias)
- `useEffect` en 10 archivos (26 ocurrencias)
- `useQueryClient` en 12 archivos (24 ocurrencias)
- `useMemo` en 10 archivos (20 ocurrencias)
- `useSessionSnapshot` en 8 archivos (15 ocurrencias)
- `useLocalSearchParams` en 7 archivos (14 ocurrencias)
- `useMobileHomeQuery` en 4 archivos (10 ocurrencias)
- `useRef` en 3 archivos (8 ocurrencias)
- `useCurrentBuilderJob` en 3 archivos (5 ocurrencias)
- `useSelectedBuilderComponent` en 2 archivos (3 ocurrencias)
- `useSessionStoreBase` en 1 archivos (3 ocurrencias)
- `useNativeDriver` en 1 archivos (2 ocurrencias)
- `useRouter` en 1 archivos (2 ocurrencias)
- `useShallow` en 1 archivos (2 ocurrencias)

## Estado Global y Datos Remotos
- Zustand
- `src/stores/builderStore.ts`
- `src/stores/sessionStore.ts`
- React Query
- `app/(auth)/apply-employee.tsx`
- `app/(auth)/magic-client.tsx`
- `app/(auth)/signup-client.tsx`
- `app/(boss)/admin/index.tsx`
- `app/(boss)/index.tsx`
- `app/(boss)/payments/[id].tsx`
- `app/(boss)/payments/index.tsx`
- `app/(boss)/queue/[id].tsx`
- `app/(boss)/queue/index.tsx`
- `app/(boss)/settings/index.tsx`
- `app/(client)/emergency/[id].tsx`
- `app/(client)/emergency/index.tsx`
- `app/(client)/emergency/new.tsx`
- `app/(client)/index.tsx`
- `app/(client)/requests/[id].tsx`
- `app/(client)/requests/index.tsx`
- `app/(client)/requests/new.tsx`
- `app/(employee)/emergency/[id].tsx`
- `app/(employee)/emergency/new.tsx`
- `app/(employee)/index.tsx`

## Dependencias Relevantes
- `@electric/builder-domain`: file:../../packages/builder-domain
- `@electric/estimator-core`: file:../../packages/estimator-core
- `@react-native-async-storage/async-storage`: 2.2.0
- `@react-navigation/native`: ^7.1.28
- `@tanstack/react-query`: ^5.90.21
- `expo`: ~55.0.5
- `expo-camera`: ~55.0.9
- `expo-constants`: ~55.0.7
- `expo-dev-client`: ~55.0.13
- `expo-document-picker`: ~55.0.8
- `expo-file-system`: ~55.0.10
- `expo-image-manipulator`: ~55.0.9
- `expo-image-picker`: ~55.0.11
- `expo-linking`: ~55.0.7
- `expo-location`: ~55.1.2
- `expo-notifications`: ~55.0.11
- `expo-router`: ~55.0.4
- `expo-secure-store`: ~55.0.8
- `expo-sharing`: ~55.0.11
- `expo-splash-screen`: ~55.0.10
- `expo-status-bar`: ~55.0.4
- `firebase`: ^12.10.0
- `react`: 19.2.0
- `react-dom`: 19.2.0
- `react-native`: 0.83.2
- `react-native-safe-area-context`: ~5.6.2
- `react-native-screens`: ~4.23.0
- `react-native-web`: ~0.21.0
- `zustand`: ^5.0.11

## Llamadas a API Detectadas
- Fetch detectados: 4
- Axios detectados: 0
- Archivos que importan api.ts: 25
- `app/(auth)/apply-employee.tsx` (1 imports relacionados)
- `app/(auth)/magic-client.tsx` (1 imports relacionados)
- `app/(auth)/signup-client.tsx` (1 imports relacionados)
- `app/(boss)/admin/index.tsx` (1 imports relacionados)
- `app/(boss)/index.tsx` (1 imports relacionados)
- `app/(boss)/payments/[id].tsx` (1 imports relacionados)
- `app/(boss)/payments/index.tsx` (1 imports relacionados)
- `app/(boss)/queue/[id].tsx` (1 imports relacionados)
- `app/(boss)/queue/index.tsx` (1 imports relacionados)
- `app/(boss)/settings/index.tsx` (1 imports relacionados)
- `app/(client)/emergency/[id].tsx` (1 imports relacionados)
- `app/(client)/emergency/new.tsx` (1 imports relacionados)
- `app/(client)/index.tsx` (1 imports relacionados)
- `app/(client)/requests/[id].tsx` (1 imports relacionados)
- `app/(client)/requests/new.tsx` (1 imports relacionados)
- `app/(employee)/emergency/[id].tsx` (1 imports relacionados)
- `app/(employee)/index.tsx` (1 imports relacionados)
- `app/(employee)/profile/index.tsx` (1 imports relacionados)
- `app/(employee)/requests/[id].tsx` (1 imports relacionados)
- `app/(employee)/requests/index.tsx` (1 imports relacionados)
- `src/lib/api.ts` (fetch: 3, axios: 0)
- `src/lib/imageUpload.ts` (fetch: 1, axios: 0)

## Problemas Potenciales
- Pantallas grandes detectadas por encima de 220 lineas: app/(builder)/jobs/[id].tsx (707 lineas), app/(auth)/apply-employee.tsx (491 lineas), app/(employee)/emergency/[id].tsx (465 lineas), app/(employee)/requests/[id].tsx (465 lineas), app/(client)/requests/[id].tsx (458 lineas).
- Pantallas con mucha logica local y hooks repetidos: app/(employee)/emergency/[id].tsx (12 consultas/mutaciones, 23 hooks), app/(employee)/requests/[id].tsx (12 consultas/mutaciones, 22 hooks), app/(client)/requests/[id].tsx (11 consultas/mutaciones, 24 hooks), app/(boss)/settings/index.tsx (9 consultas/mutaciones, 40 hooks), app/(boss)/admin/index.tsx (9 consultas/mutaciones, 15 hooks).
- Rutas funcionalmente parecidas repartidas entre grupos: / en boss, builder, client, employee, /emergency/[id] en client, employee, /emergency/new en client, employee, /requests en client, employee, /requests/[id] en client, employee.
- 20 pantallas importan el cliente API directamente; conviene extraer hooks o servicios por feature.
- Se detecto friccion de tipado y casts de navegacion: app/(client)/index.tsx (as never: 6, any: 0), app/(builder)/index.tsx (as never: 5, any: 0), app/(auth)/login.tsx (as never: 3, any: 0), app/(boss)/index.tsx (as never: 3, any: 0), src/providers/NotificationRouterProvider.tsx (as never: 3, any: 0).

## Recomendaciones de Mejora
- Extraer hooks por feature para rutas con varias consultas o mutaciones, especialmente en flujos de requests, emergency y boss.
- Dividir pantallas grandes en componentes presentacionales y contenedores de datos para reducir el peso de cada screen.
- Centralizar helpers de navegacion tipada para reducir el uso de casts `as never` con Expo Router.
- Revisar rutas duplicadas entre grupos para consolidar UI y reutilizar logica compartida.
- Aprovechar mejor `src/hooks/` para encapsular React Query y evitar que las pantallas importen directamente el cliente API.
- Definir limites claros entre estado global en Zustand y estado remoto en React Query para evitar mezclar responsabilidades.

## Backlog de Tareas Sugeridas para AutoDev
- Crear hooks de dominio para requests y emergency, reemplazando imports directos de `src/lib/api.ts` en pantallas.
- Refactorizar las pantallas mas grandes detectadas por el inspector en componentes y hooks reutilizables.
- Introducir un helper tipado para `router.push` y `router.replace` que elimine la mayoria de `as never`.
- Consolidar patrones repetidos entre `client`, `employee` y `boss` en componentes compartidos.
- Agregar una segunda pasada del inspector para correlacionar rutas con servicios, stores y hooks custom por feature.
- Auditar rutas compartidas entre grupos (/, /emergency/[id], /emergency/new) para detectar logica duplicada.
