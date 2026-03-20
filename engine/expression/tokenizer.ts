export type TokenType = "number" | "identifier" | "operator" | "paren" | "comma" | "dot";

export interface Token {
  type: TokenType;
  value: string;
  index: number;
}

const TWO_CHAR_OPERATORS = new Set([">=", "<=", "==", "!=", "&&", "||"]);
const ONE_CHAR_OPERATORS = new Set(["+", "-", "*", "/", "%", "^", "<", ">", "!"]);

export function tokenize(expression: string): Token[] {
  const src = String(expression || "");
  const tokens: Token[] = [];
  let i = 0;

  while (i < src.length) {
    const char = src[i];

    if (/\s/.test(char)) {
      i += 1;
      continue;
    }

    const pair = src.slice(i, i + 2);
    if (TWO_CHAR_OPERATORS.has(pair)) {
      tokens.push({ type: "operator", value: pair, index: i });
      i += 2;
      continue;
    }

    if (ONE_CHAR_OPERATORS.has(char)) {
      tokens.push({ type: "operator", value: char, index: i });
      i += 1;
      continue;
    }

    if (char === "(") {
      tokens.push({ type: "paren", value: "(", index: i });
      i += 1;
      continue;
    }

    if (char === ")") {
      tokens.push({ type: "paren", value: ")", index: i });
      i += 1;
      continue;
    }

    if (char === ",") {
      tokens.push({ type: "comma", value: ",", index: i });
      i += 1;
      continue;
    }

    if (char === ".") {
      tokens.push({ type: "dot", value: ".", index: i });
      i += 1;
      continue;
    }

    if (/\d/.test(char)) {
      const start = i;
      i += 1;
      while (i < src.length && /[\d_]/.test(src[i])) i += 1;
      if (src[i] === ".") {
        i += 1;
        while (i < src.length && /[\d_]/.test(src[i])) i += 1;
      }
      const value = src.slice(start, i).replace(/_/g, "");
      tokens.push({ type: "number", value, index: start });
      continue;
    }

    if (/[a-zA-Z_]/.test(char)) {
      const start = i;
      i += 1;
      while (i < src.length && /[a-zA-Z0-9_]/.test(src[i])) i += 1;
      tokens.push({ type: "identifier", value: src.slice(start, i), index: start });
      continue;
    }

    throw new Error(`Unexpected token '${char}' at position ${i}.`);
  }

  return tokens;
}
