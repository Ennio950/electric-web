# Sistema Universal de Cotizacion (React)

App pro-grade en React + TypeScript para cotizar trabajos genéricos con modelo:

- Catalogo de Materiales
- Recetas
- Arbol de Componentes (LEGO)
- Trabajo (Job)

## Stack

- React 18 + TypeScript + Vite
- TailwindCSS + componentes estilo shadcn/ui
- Zustand (persistencia localStorage)
- Zod (schemas)
- React Hook Form
- TanStack Query (provider listo)
- Motor de formulas seguro (sin `eval`)

## Ejecutar

```bash
cd builder-react
npm install
npm run dev
```

Si necesitas que el portal integrado use esta app por el backend principal, desde la raiz usa:

```bash
npm run dev
```

Build de produccion:

```bash
npm run build
```

Build en watch para servir `dist/` desde el backend:

```bash
npm run build:watch
```

Tests del builder:

```bash
npm run test
```

## Flujo Asistido

1. **Dashboard**: crear o abrir trabajo.
2. **Job Builder**:
   - Arbol de componentes (izquierda)
   - Wizard guiado (centro):
     - Medicion
     - Recetas
     - Materiales/Precios
     - Mano de obra/Desperdicio
3. **Results**:
   - Total general
   - Tabla de materiales
   - Subtotales por componente
   - Panel colapsable "Como se calculo"

## Modo Experto

Activa "Modo experto" en el header para:

- Editar formula base y derivadas del componente.
- Editar expresiones de salida de recetas.
- Gestion avanzada de recetas/materiales.

## Crear Material

En `Materiales`:

- Define `id`, `name`, `baseUnit`, `unitPrice`, `currency`.
- Opcional densidad `kg/m3` para conversion masa<->volumen.
- Conversiones personalizadas por linea:
  - `from>to=factor`
  - Ejemplo: `caja>pza=100`

## Crear Receta

En `Recetas`:

- Define tipo (`BY_AREA`, `BY_VOLUME`, etc.) y unidad base.
- Parametros por linea:
  - `id|label|unit|default|required`
- Salidas por linea:
  - `materialId|qtyExpr|unit|rounding|decimals|wastePct`

Variables disponibles en `qtyExpr`:

- `baseQty`
- params definidos en la receta
- inputs/derived del componente vinculado

Funciones permitidas:

- `min`, `max`, `ceil`, `floor`, `round`, `clamp`

## Crear Componente

En Job Builder:

- Agrega parte en el arbol.
- Elige medicion (area, volumen, longitud, cantidad, etc.).
- Llena medidas.
- Vincula recetas y ajusta parametros.
- Ajusta mano de obra y merma.

## Import / Export

- Dashboard: backup completo (`materials + recipes + jobs`).
- Materiales: import/export granular.
- Recetas: import/export granular.
- Results: export JSON del job + resultado.

## Estructura

```txt
src/
  app/
  components/
  features/
    jobs/
    componentsTree/
    materials/
    recipes/
    calculator/
    importExport/
  core/
  store/
  schemas/
  data/
```
