const UNIT_TABLE = {
  length: {
    mm: 0.001,
    cm: 0.01,
    m: 1,
    in: 0.0254,
    ft: 0.3048
  },
  area: {
    mm2: 0.000001,
    cm2: 0.0001,
    m2: 1,
    ft2: 0.092903,
    in2: 0.00064516
  },
  volume: {
    ml: 0.001,
    l: 1,
    m3: 1000,
    ft3: 28.3168
  },
  mass: {
    g: 0.001,
    kg: 1,
    lb: 0.453592,
    oz: 0.0283495
  },
  count: {
    pza: 1,
    pieza: 1,
    piezas: 1,
    unit: 1,
    bolsa: 1,
    bolsas: 1,
    block: 1,
    bloque: 1
  },
  percent: {
    '%': 1
  },
  ratio: {
    ratio: 1,
    'm2/l': 1,
    'm3/m3': 1,
    'bolsa/m3': 1,
    'q/pza': 1,
    'q/bolsa': 1,
    'q/m': 1,
    'q/m2': 1,
    'q/m3': 1,
    'q/l': 1,
    q: 1
  }
};

const UNIT_ALIASES = {
  metro: 'm',
  metros: 'm',
  centimetro: 'cm',
  centimetros: 'cm',
  milimetro: 'mm',
  milimetros: 'mm',
  litro: 'l',
  litros: 'l',
  bolsa: 'bolsa',
  bolsas: 'bolsa',
  pieza: 'pza',
  piezas: 'pza',
  unidad: 'unit',
  unidades: 'unit'
};

function normalizeUnit(unit) {
  return String(unit || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}

function canonicalUnit(unit) {
  const normalized = normalizeUnit(unit);
  if (!normalized) return '';
  return UNIT_ALIASES[normalized] || normalized;
}

function findUnitCategory(unit) {
  const target = canonicalUnit(unit);
  if (!target) return null;

  for (const [category, map] of Object.entries(UNIT_TABLE)) {
    if (Object.prototype.hasOwnProperty.call(map, target)) {
      return category;
    }
  }
  return null;
}

function getFactor(unit) {
  const normalized = canonicalUnit(unit);
  const category = findUnitCategory(normalized);
  if (!category) return null;
  return {
    category,
    factor: UNIT_TABLE[category][normalized],
    unit: normalized
  };
}

function convert(value, fromUnit, toUnit) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new Error(`No se puede convertir valor invalido: ${value}`);
  }

  const from = getFactor(fromUnit);
  const to = getFactor(toUnit);

  if (!from || !to) {
    throw new Error(`Unidad no soportada (${fromUnit} -> ${toUnit}).`);
  }
  if (from.category !== to.category) {
    throw new Error(`No se puede convertir de ${from.unit} a ${to.unit}.`);
  }

  const baseValue = number * from.factor;
  return baseValue / to.factor;
}

function parseLocaleNumber(value) {
  if (typeof value === 'number') return value;
  const text = String(value ?? '').trim();
  if (!text) return NaN;

  const compact = text.replace(/\s+/g, '');
  const hasDot = compact.includes('.');
  const hasComma = compact.includes(',');

  let normalized = compact;
  if (hasDot && hasComma) {
    if (compact.lastIndexOf(',') > compact.lastIndexOf('.')) {
      normalized = compact.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = compact.replace(/,/g, '');
    }
  } else if (hasComma) {
    normalized = compact.replace(',', '.');
  }

  return Number.parseFloat(normalized);
}

function formatNumber(value, precision = 2) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '0';
  return numeric.toLocaleString('es-GT', {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision
  });
}

function suggestPrecisionByUnit(unit) {
  const normalized = canonicalUnit(unit);
  const category = findUnitCategory(normalized);
  if (!category) return 2;

  if (category === 'count') return 0;
  if (category === 'volume') return 3;
  if (normalized === '%') return 2;
  return 2;
}

function listKnownUnits() {
  return Object.entries(UNIT_TABLE).reduce((acc, [category, map]) => {
    acc[category] = Object.keys(map);
    return acc;
  }, {});
}

export const unitSystem = {
  normalizeUnit: canonicalUnit,
  findUnitCategory,
  convert,
  parseLocaleNumber,
  formatNumber,
  suggestPrecisionByUnit,
  listKnownUnits
};
