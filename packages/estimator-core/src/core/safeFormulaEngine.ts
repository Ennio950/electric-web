import { topoSort } from './topoSort';

type Token =
  | { type: 'number'; value: number }
  | { type: 'identifier'; value: string }
  | { type: 'symbol'; value: string };

const ALLOWED_CHARS = /^[\d\w_+\-*/().,\s]+$/;

const SAFE_FUNCTIONS: Record<string, (...args: number[]) => number> = {
  min: (...args) => Math.min(...args),
  max: (...args) => Math.max(...args),
  ceil: (value) => Math.ceil(value),
  floor: (value) => Math.floor(value),
  round: (value, digits = 0) => {
    const pow = 10 ** Math.max(0, Math.floor(digits));
    return Math.round(value * pow) / pow;
  },
  clamp: (value, minValue, maxValue) => Math.min(Math.max(value, minValue), maxValue),
};

const RESERVED = new Set(['baseQty', 'params', 'inputs', 'derived', 'true', 'false']);

function sanitizeExpression(expr: string) {
  const source = String(expr || '').trim();
  if (!source) {
    throw new Error('Formula vacia.');
  }
  if (!ALLOWED_CHARS.test(source)) {
    throw new Error('La formula contiene caracteres no permitidos.');
  }
  return source.replace(/\s+/g, ' ').trim();
}

function tokenize(expression: string): Token[] {
  const source = sanitizeExpression(expression);
  const tokens: Token[] = [];

  let i = 0;
  while (i < source.length) {
    const ch = source[i];

    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }

    if (/[0-9.]/.test(ch)) {
      let j = i;
      let dots = 0;
      while (j < source.length && /[0-9.]/.test(source[j])) {
        if (source[j] === '.') dots += 1;
        j += 1;
      }
      const raw = source.slice(i, j);
      if (raw === '.' || dots > 1) {
        throw new Error(`Numero invalido: ${raw}`);
      }
      tokens.push({ type: 'number', value: Number(raw) });
      i = j;
      continue;
    }

    if (/[A-Za-z_]/.test(ch)) {
      let j = i;
      while (j < source.length && /[A-Za-z0-9_.]/.test(source[j])) {
        j += 1;
      }
      tokens.push({ type: 'identifier', value: source.slice(i, j) });
      i = j;
      continue;
    }

    if ('+-*/(),'.includes(ch)) {
      tokens.push({ type: 'symbol', value: ch });
      i += 1;
      continue;
    }

    throw new Error(`Token no permitido: ${ch}`);
  }

  return tokens;
}

function resolveVariable(scope: Record<string, unknown>, name: string): number {
  if (Object.prototype.hasOwnProperty.call(scope, name)) {
    const value = Number(scope[name]);
    if (Number.isFinite(value)) return value;
  }

  if (name.includes('.')) {
    const path = name.split('.');
    let ref: unknown = scope;
    for (const key of path) {
      if (!ref || typeof ref !== 'object' || !Object.prototype.hasOwnProperty.call(ref, key)) {
        ref = undefined;
        break;
      }
      ref = (ref as Record<string, unknown>)[key];
    }

    const value = Number(ref);
    if (Number.isFinite(value)) return value;
  }

  throw new Error(`Variable no definida: ${name}`);
}

function parseTokens(tokens: Token[], scope: Record<string, unknown>): number {
  let cursor = 0;

  const peek = (offset = 0) => tokens[cursor + offset] || null;
  const consume = (expected?: string) => {
    const token = peek();
    if (!token) throw new Error('Formula incompleta.');
    if (expected && token.value !== expected) {
      throw new Error(`Se esperaba ${expected} y llego ${token.value}`);
    }
    cursor += 1;
    return token;
  };

  const parseExpression = (): number => {
    let value = parseTerm();
    while (true) {
      const token = peek();
      if (!token || token.type !== 'symbol' || (token.value !== '+' && token.value !== '-')) break;
      consume();
      const right = parseTerm();
      value = token.value === '+' ? value + right : value - right;
    }
    return value;
  };

  const parseTerm = (): number => {
    let value = parseUnary();
    while (true) {
      const token = peek();
      if (!token || token.type !== 'symbol' || (token.value !== '*' && token.value !== '/')) break;
      consume();
      const right = parseUnary();
      if (token.value === '*') {
        value *= right;
      } else {
        if (right === 0) throw new Error('Division por cero.');
        value /= right;
      }
    }
    return value;
  };

  const parseUnary = (): number => {
    const token = peek();
    if (token && token.type === 'symbol' && (token.value === '+' || token.value === '-')) {
      consume();
      const value = parseUnary();
      return token.value === '-' ? -value : value;
    }
    return parsePrimary();
  };

  const parseArgs = (): number[] => {
    const args: number[] = [];
    if (peek() && peek()?.type === 'symbol' && peek()?.value === ')') {
      return args;
    }

    while (true) {
      args.push(parseExpression());
      const token = peek();
      if (!token) throw new Error('Falta cerrar parentesis en funcion.');
      if (token.type === 'symbol' && token.value === ',') {
        consume(',');
        continue;
      }
      break;
    }

    return args;
  };

  const parsePrimary = (): number => {
    const token = peek();
    if (!token) throw new Error('Formula incompleta.');

    if (token.type === 'number') {
      consume();
      return token.value;
    }

    if (token.type === 'identifier') {
      consume();
      if (peek() && peek()?.type === 'symbol' && peek()?.value === '(') {
        consume('(');
        const args = parseArgs();
        consume(')');

        const fn = SAFE_FUNCTIONS[token.value];
        if (!fn) throw new Error(`Funcion no permitida: ${token.value}`);
        const value = fn(...args);
        if (!Number.isFinite(value)) throw new Error(`Resultado invalido en funcion ${token.value}`);
        return value;
      }

      return resolveVariable(scope, token.value);
    }

    if (token.type === 'symbol' && token.value === '(') {
      consume('(');
      const value = parseExpression();
      consume(')');
      return value;
    }

    throw new Error(`Token inesperado ${token.value}`);
  };

  const result = parseExpression();
  if (cursor < tokens.length) {
    throw new Error(`Token extra en formula: ${tokens[cursor].value}`);
  }
  return result;
}

export function evaluateExpression(expression: string, scope: Record<string, unknown>): number {
  const tokens = tokenize(expression);
  const value = parseTokens(tokens, scope);
  if (!Number.isFinite(value)) {
    throw new Error('La formula produjo un valor no valido.');
  }
  return value;
}

export function extractDependencies(expression: string): string[] {
  const tokens = tokenize(expression);
  const deps = new Set<string>();

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token.type !== 'identifier') continue;

    const next = tokens[i + 1];
    const isFunctionCall = next?.type === 'symbol' && next.value === '(';
    if (isFunctionCall && SAFE_FUNCTIONS[token.value]) continue;
    if (RESERVED.has(token.value)) continue;

    const depName = token.value.startsWith('derived.') ? token.value.replace('derived.', '') : token.value;
    deps.add(depName);
  }

  return Array.from(deps);
}

export type DerivedExpression = {
  id: string;
  formula: string;
};

export function evaluateDerivedList(
  list: DerivedExpression[],
  baseScope: Record<string, unknown>,
): { values: Record<string, number>; ordered: DerivedExpression[] } {
  if (!list.length) {
    return { values: {}, ordered: [] };
  }

  const map = new Map(list.map((item) => [item.id, item]));
  const nodes = list.map((item) => ({
    id: item.id,
    dependencies: extractDependencies(item.formula).filter((dep) => map.has(dep)),
  }));

  const sortedIds = topoSort(nodes);
  const scope: Record<string, unknown> = {
    ...baseScope,
    derived: {},
  };
  const values: Record<string, number> = {};

  sortedIds.forEach((id) => {
    const item = map.get(id);
    if (!item) return;
    const value = evaluateExpression(item.formula, scope);
    values[id] = value;
    scope[id] = value;
    (scope.derived as Record<string, number>)[id] = value;
  });

  return {
    values,
    ordered: sortedIds.map((id) => map.get(id)).filter(Boolean) as DerivedExpression[],
  };
}
