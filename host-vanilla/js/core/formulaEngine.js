const ALLOWED_CHARS = /^[\d\w_+\-*/().,\s]+$/;

const FUNCTION_MAP = {
  min: (...args) => Math.min(...args),
  max: (...args) => Math.max(...args),
  ceil: (value) => Math.ceil(value),
  floor: (value) => Math.floor(value),
  round: (value, digits = 0) => {
    const factor = 10 ** Math.max(0, Math.floor(Number(digits) || 0));
    return Math.round(value * factor) / factor;
  },
  safeCeil: (value, step = 1) => {
    const safeStep = Number(step) || 1;
    if (safeStep === 0) return value;
    return Math.ceil(value / safeStep) * safeStep;
  },
  safeRound: (value, digits = 2) => {
    const factor = 10 ** Math.max(0, Math.floor(Number(digits) || 0));
    return Math.round(value * factor) / factor;
  },
  clamp: (value, minValue, maxValue) => Math.min(Math.max(value, minValue), maxValue),
  abs: (value) => Math.abs(value),
  pow: (a, b) => Math.pow(a, b)
};

const RESERVED = new Set(['true', 'false', 'null', 'undefined', 'inputs', 'derived', 'material']);

function sanitizeExpression(expression) {
  const source = String(expression || '').trim();
  if (!source) {
    throw new Error('Formula vacia.');
  }
  if (!ALLOWED_CHARS.test(source)) {
    throw new Error('La formula contiene caracteres no permitidos.');
  }

  return source
    .replace(/Math\.min\s*\(/g, 'min(')
    .replace(/Math\.max\s*\(/g, 'max(')
    .replace(/Math\.ceil\s*\(/g, 'ceil(')
    .replace(/Math\.floor\s*\(/g, 'floor(')
    .replace(/Math\.round\s*\(/g, 'round(')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(expression) {
  const tokens = [];
  const source = sanitizeExpression(expression);

  let index = 0;
  while (index < source.length) {
    const char = source[index];

    if (/\s/.test(char)) {
      index += 1;
      continue;
    }

    if (/[\d.]/.test(char)) {
      let end = index;
      let dotCount = 0;
      while (end < source.length && /[\d.]/.test(source[end])) {
        if (source[end] === '.') dotCount += 1;
        end += 1;
      }
      const rawNumber = source.slice(index, end);
      if (dotCount > 1 || rawNumber === '.') {
        throw new Error(`Numero invalido en formula: '${rawNumber}'.`);
      }
      tokens.push({ type: 'number', value: Number(rawNumber) });
      index = end;
      continue;
    }

    if (/[A-Za-z_]/.test(char)) {
      let end = index;
      while (end < source.length && /[A-Za-z0-9_.]/.test(source[end])) {
        end += 1;
      }
      const name = source.slice(index, end);
      tokens.push({ type: 'identifier', value: name });
      index = end;
      continue;
    }

    if ('+-*/(),'.includes(char)) {
      tokens.push({ type: 'symbol', value: char });
      index += 1;
      continue;
    }

    throw new Error(`Token no permitido '${char}' en formula.`);
  }

  return tokens;
}

function resolveVariable(scope, rawName) {
  const name = String(rawName || '').trim();
  if (!name) {
    throw new Error('Variable vacia en formula.');
  }

  if (Object.prototype.hasOwnProperty.call(scope, name)) {
    const direct = scope[name];
    if (typeof direct === 'number') return direct;
    const maybeNumber = Number(direct);
    if (Number.isFinite(maybeNumber)) return maybeNumber;
    throw new Error(`Variable '${name}' no es numerica.`);
  }

  if (name.includes('.')) {
    const segments = name.split('.');
    let current = scope;
    for (const segment of segments) {
      if (!current || !Object.prototype.hasOwnProperty.call(current, segment)) {
        current = undefined;
        break;
      }
      current = current[segment];
    }

    if (typeof current === 'number') return current;
    const maybeNumber = Number(current);
    if (Number.isFinite(maybeNumber)) return maybeNumber;
  }

  throw new Error(`Variable no encontrada: '${name}'.`);
}

function parseTokens(tokens, scope) {
  let cursor = 0;

  function peek(offset = 0) {
    return tokens[cursor + offset] || null;
  }

  function consume(expectedValue = null) {
    const token = peek();
    if (!token) {
      throw new Error('Formula incompleta.');
    }
    if (expectedValue && token.value !== expectedValue) {
      throw new Error(`Se esperaba '${expectedValue}' y se encontro '${token.value}'.`);
    }
    cursor += 1;
    return token;
  }

  function parseExpression() {
    let value = parseTerm();

    while (true) {
      const token = peek();
      if (!token || token.type !== 'symbol' || (token.value !== '+' && token.value !== '-')) {
        break;
      }
      consume();
      const right = parseTerm();
      value = token.value === '+' ? value + right : value - right;
    }

    return value;
  }

  function parseTerm() {
    let value = parseUnary();

    while (true) {
      const token = peek();
      if (!token || token.type !== 'symbol' || (token.value !== '*' && token.value !== '/')) {
        break;
      }
      consume();
      const right = parseUnary();
      if (token.value === '*') {
        value *= right;
      } else {
        if (right === 0) {
          throw new Error('Division por cero en formula.');
        }
        value /= right;
      }
    }

    return value;
  }

  function parseUnary() {
    const token = peek();
    if (token && token.type === 'symbol' && (token.value === '+' || token.value === '-')) {
      consume();
      const value = parseUnary();
      return token.value === '-' ? -value : value;
    }
    return parsePrimary();
  }

  function parseArguments() {
    const args = [];
    if (peek() && peek().type === 'symbol' && peek().value === ')') {
      return args;
    }

    while (true) {
      args.push(parseExpression());
      const token = peek();
      if (!token) {
        throw new Error('Falta cerrar parentesis en llamada de funcion.');
      }
      if (token.type === 'symbol' && token.value === ',') {
        consume(',');
        continue;
      }
      break;
    }
    return args;
  }

  function parsePrimary() {
    const token = peek();
    if (!token) {
      throw new Error('Formula incompleta.');
    }

    if (token.type === 'number') {
      consume();
      return token.value;
    }

    if (token.type === 'identifier') {
      consume();
      const maybeCall = peek();
      if (maybeCall && maybeCall.type === 'symbol' && maybeCall.value === '(') {
        consume('(');
        const args = parseArguments();
        consume(')');

        const fnName = token.value;
        const fn = FUNCTION_MAP[fnName];
        if (!fn) {
          throw new Error(`Funcion no permitida: '${fnName}'.`);
        }

        const value = fn(...args);
        if (!Number.isFinite(value)) {
          throw new Error(`Resultado invalido en funcion '${fnName}'.`);
        }
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

    throw new Error(`Token inesperado '${token.value}'.`);
  }

  const finalValue = parseExpression();
  if (cursor < tokens.length) {
    throw new Error(`Token extra en formula: '${tokens[cursor].value}'.`);
  }

  return finalValue;
}

function evaluateExpression(expression, scope = {}) {
  const tokens = tokenize(expression);
  const value = parseTokens(tokens, scope);
  if (!Number.isFinite(value)) {
    throw new Error('La formula produjo un valor invalido.');
  }
  return value;
}

function extractDependencies(expression) {
  const tokens = tokenize(expression);
  const dependencies = new Set();

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.type !== 'identifier') continue;

    const next = tokens[index + 1];
    const isFunctionCall = next && next.type === 'symbol' && next.value === '(';
    if (isFunctionCall && FUNCTION_MAP[token.value]) {
      continue;
    }
    if (RESERVED.has(token.value)) {
      continue;
    }

    dependencies.add(token.value);
  }

  return Array.from(dependencies);
}

function normalizeDependencyName(name) {
  if (!name) return '';
  if (name.startsWith('derived.')) return name.slice('derived.'.length);
  return name;
}

function sortDerivedByDependencies(derivedList = []) {
  const nodes = new Map();
  derivedList.forEach((item) => {
    if (!item?.id) return;
    nodes.set(item.id, {
      id: item.id,
      item,
      outgoing: new Set(),
      incoming: 0
    });
  });

  nodes.forEach((node) => {
    const deps = extractDependencies(node.item.formula || '0')
      .map(normalizeDependencyName)
      .filter((dep) => dep && nodes.has(dep) && dep !== node.id);

    deps.forEach((dep) => {
      const depNode = nodes.get(dep);
      depNode.outgoing.add(node.id);
      node.incoming += 1;
    });
  });

  const queue = [];
  nodes.forEach((node) => {
    if (node.incoming === 0) queue.push(node.id);
  });

  const ordered = [];
  while (queue.length) {
    const id = queue.shift();
    ordered.push(nodes.get(id).item);

    nodes.get(id).outgoing.forEach((targetId) => {
      const target = nodes.get(targetId);
      target.incoming -= 1;
      if (target.incoming === 0) queue.push(target.id);
    });
  }

  if (ordered.length !== nodes.size) {
    throw new Error('Dependencia circular detectada en formulas derivadas.');
  }

  return ordered;
}

function evaluateDerivedList(derivedList, baseScope) {
  const ordered = sortDerivedByDependencies(derivedList);
  const derivedValues = {};
  const scope = {
    ...baseScope,
    derived: { ...(baseScope.derived || {}) }
  };

  ordered.forEach((item) => {
    const value = evaluateExpression(item.formula, scope);
    derivedValues[item.id] = value;
    scope[item.id] = value;
    scope.derived[item.id] = value;
  });

  return {
    derivedValues,
    ordered
  };
}

export const formulaEngine = {
  sanitizeExpression,
  tokenize,
  evaluateExpression,
  extractDependencies,
  sortDerivedByDependencies,
  evaluateDerivedList,
  allowedFunctions: Object.keys(FUNCTION_MAP)
};
