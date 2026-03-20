import type { MeasureType, QuoteComponent } from '@electric/estimator-core';

import { uid } from './uid';

function baseComponent(name: string, measureType: MeasureType, baseUnit: string, expr: string): QuoteComponent {
  return {
    id: uid('cmp'),
    name,
    measureType,
    inputs: [],
    inputValues: {},
    derived: [],
    baseMeasure: {
      unit: baseUnit,
      expr
    },
    recipeBindings: [],
    labor: {
      mode: 'NONE',
      rate: 0,
      hours: 0
    },
    wastePct: 0,
    children: []
  };
}

export function createComponentByMeasure(measureType: MeasureType): QuoteComponent {
  switch (measureType) {
    case 'AREA':
      return {
        ...baseComponent('Nueva parte area', 'AREA', 'm2', 'largo * ancho'),
        inputs: [
          { id: 'largo', label: 'Largo', unit: 'm', required: true, example: '4', help: 'Largo principal' },
          { id: 'ancho', label: 'Ancho', unit: 'm', required: true, example: '3', help: 'Ancho principal' }
        ],
        inputValues: { largo: 4, ancho: 3 }
      };
    case 'VOLUME':
      return {
        ...baseComponent('Nueva parte volumen', 'VOLUME', 'm3', 'largo * ancho * alto'),
        inputs: [
          { id: 'largo', label: 'Largo', unit: 'm', required: true, example: '4' },
          { id: 'ancho', label: 'Ancho', unit: 'm', required: true, example: '3' },
          { id: 'alto', label: 'Alto', unit: 'm', required: true, example: '2.5' }
        ],
        inputValues: { largo: 4, ancho: 3, alto: 2.5 }
      };
    case 'LENGTH':
      return {
        ...baseComponent('Nueva parte longitud', 'LENGTH', 'm', 'longitud'),
        inputs: [{ id: 'longitud', label: 'Longitud', unit: 'm', required: true, example: '20' }],
        inputValues: { longitud: 20 }
      };
    case 'COUNT':
    case 'ASSEMBLY':
      return {
        ...baseComponent('Nueva parte cantidad', measureType, 'pza', 'cantidad'),
        inputs: [{ id: 'cantidad', label: 'Cantidad', unit: 'pza', required: true, example: '10' }],
        inputValues: { cantidad: 10 }
      };
    case 'TIME':
      return {
        ...baseComponent('Nueva parte tiempo', 'TIME', 'h', 'horas'),
        inputs: [{ id: 'horas', label: 'Horas', unit: 'h', required: true, example: '8' }],
        inputValues: { horas: 8 }
      };
    case 'CUSTOM_FORMULA':
    default:
      return {
        ...baseComponent('Nueva parte personalizada', 'CUSTOM_FORMULA', 'unit', 'cantidad')
      };
  }
}

export function applyMeasurePreset(component: QuoteComponent, measureType: MeasureType): QuoteComponent {
  const preset = createComponentByMeasure(measureType);
  return {
    ...component,
    measureType,
    inputs: preset.inputs,
    inputValues: preset.inputValues,
    baseMeasure: preset.baseMeasure,
    derived: measureType === 'CUSTOM_FORMULA' ? component.derived : []
  };
}
