import { Token, tokenize } from "./tokenizer.js";

export type AstNode =
  | { type: "Literal"; value: number | boolean }
  | { type: "Identifier"; path: string[] }
  | { type: "UnaryExpression"; operator: string; argument: AstNode }
  | { type: "BinaryExpression"; operator: string; left: AstNode; right: AstNode }
  | { type: "CallExpression"; callee: string; args: AstNode[] };

class Parser {
  private readonly tokens: Token[];
  private index = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parse(): AstNode {
    const expression = this.parseLogicalOr();
    if (!this.isAtEnd()) {
      const token = this.peek();
      throw new Error(`Unexpected token '${token?.value ?? "EOF"}' near position ${token?.index ?? -1}.`);
    }
    return expression;
  }

  private parseLogicalOr(): AstNode {
    let node = this.parseLogicalAnd();
    while (this.matchOperator("||")) {
      const operator = this.previous().value;
      const right = this.parseLogicalAnd();
      node = { type: "BinaryExpression", operator, left: node, right };
    }
    return node;
  }

  private parseLogicalAnd(): AstNode {
    let node = this.parseEquality();
    while (this.matchOperator("&&")) {
      const operator = this.previous().value;
      const right = this.parseEquality();
      node = { type: "BinaryExpression", operator, left: node, right };
    }
    return node;
  }

  private parseEquality(): AstNode {
    let node = this.parseComparison();
    while (this.matchOperator("==", "!=")) {
      const operator = this.previous().value;
      const right = this.parseComparison();
      node = { type: "BinaryExpression", operator, left: node, right };
    }
    return node;
  }

  private parseComparison(): AstNode {
    let node = this.parseTerm();
    while (this.matchOperator(">", ">=", "<", "<=")) {
      const operator = this.previous().value;
      const right = this.parseTerm();
      node = { type: "BinaryExpression", operator, left: node, right };
    }
    return node;
  }

  private parseTerm(): AstNode {
    let node = this.parseFactor();
    while (this.matchOperator("+", "-")) {
      const operator = this.previous().value;
      const right = this.parseFactor();
      node = { type: "BinaryExpression", operator, left: node, right };
    }
    return node;
  }

  private parseFactor(): AstNode {
    let node = this.parsePower();
    while (this.matchOperator("*", "/", "%")) {
      const operator = this.previous().value;
      const right = this.parsePower();
      node = { type: "BinaryExpression", operator, left: node, right };
    }
    return node;
  }

  private parsePower(): AstNode {
    let node = this.parseUnary();
    while (this.matchOperator("^")) {
      const operator = this.previous().value;
      const right = this.parseUnary();
      node = { type: "BinaryExpression", operator, left: node, right };
    }
    return node;
  }

  private parseUnary(): AstNode {
    if (this.matchOperator("!", "-", "+")) {
      const operator = this.previous().value;
      const argument = this.parseUnary();
      return { type: "UnaryExpression", operator, argument };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): AstNode {
    if (this.matchType("number")) {
      const raw = this.previous().value;
      const value = Number(raw);
      if (!Number.isFinite(value)) {
        throw new Error(`Invalid numeric literal '${raw}'.`);
      }
      return { type: "Literal", value };
    }

    if (this.matchType("identifier")) {
      const first = this.previous().value;
      const path: string[] = [first];

      while (this.matchType("dot")) {
        this.consumeType("identifier", "Expected identifier after '.'.");
        path.push(this.previous().value);
      }

      if (path.length === 1 && (path[0] === "true" || path[0] === "false")) {
        return { type: "Literal", value: path[0] === "true" };
      }

      if (this.matchParen("(")) {
        const args: AstNode[] = [];
        if (!this.checkParen(")")) {
          do {
            args.push(this.parseLogicalOr());
          } while (this.matchType("comma"));
        }
        this.consumeParen(")", "Expected ')' after function arguments.");
        return { type: "CallExpression", callee: path.join("."), args };
      }

      return { type: "Identifier", path };
    }

    if (this.matchParen("(")) {
      const expr = this.parseLogicalOr();
      this.consumeParen(")", "Expected ')' after expression.");
      return expr;
    }

    const token = this.peek();
    throw new Error(`Unexpected token '${token?.value ?? "EOF"}' at position ${token?.index ?? -1}.`);
  }

  private matchOperator(...operators: string[]): boolean {
    if (!this.checkType("operator")) return false;
    const token = this.peek();
    if (!token || !operators.includes(token.value)) return false;
    this.index += 1;
    return true;
  }

  private matchType(type: Token["type"]): boolean {
    if (!this.checkType(type)) return false;
    this.index += 1;
    return true;
  }

  private matchParen(value: "(" | ")"): boolean {
    if (!this.checkType("paren")) return false;
    if (this.peek()?.value !== value) return false;
    this.index += 1;
    return true;
  }

  private checkType(type: Token["type"]): boolean {
    if (this.isAtEnd()) return false;
    return this.peek()?.type === type;
  }

  private checkParen(value: "(" | ")"): boolean {
    if (!this.checkType("paren")) return false;
    return this.peek()?.value === value;
  }

  private consumeType(type: Token["type"], message: string): void {
    if (this.checkType(type)) {
      this.index += 1;
      return;
    }
    throw new Error(message);
  }

  private consumeParen(value: "(" | ")", message: string): void {
    if (this.checkParen(value)) {
      this.index += 1;
      return;
    }
    throw new Error(message);
  }

  private previous(): Token {
    return this.tokens[this.index - 1];
  }

  private peek(): Token | undefined {
    return this.tokens[this.index];
  }

  private isAtEnd(): boolean {
    return this.index >= this.tokens.length;
  }
}

export function parseExpression(input: string): AstNode {
  const tokens = tokenize(input);
  const parser = new Parser(tokens);
  return parser.parse();
}
