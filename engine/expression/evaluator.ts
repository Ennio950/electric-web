import { WHITELISTED_FUNCTIONS } from "./functions.js";
import { AstNode, parseExpression } from "./parser.js";

export interface EvalContext {
  inputs: Record<string, unknown>;
  computed: Record<string, unknown>;
  [key: string]: unknown;
}

export interface EvalOptions {
  throwOnUnknown?: boolean;
}

function isNumeric(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function toNumber(value: unknown, hint: string): number {
  if (isNumeric(value)) return value;
  const asNumber = Number(value);
  if (Number.isFinite(asNumber)) return asNumber;
  throw new Error(`Expected numeric value for '${hint}', received '${String(value)}'.`);
}

function resolvePath(path: string[], context: EvalContext, throwOnUnknown = true): unknown {
  let current: unknown = context;
  for (const key of path) {
    if (current == null || typeof current !== "object" || !(key in (current as Record<string, unknown>))) {
      if (throwOnUnknown) {
        throw new Error(`Unknown variable '${path.join(".")}'.`);
      }
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function evaluateNode(node: AstNode, context: EvalContext, options: EvalOptions): unknown {
  if (node.type === "Literal") {
    return node.value;
  }

  if (node.type === "Identifier") {
    return resolvePath(node.path, context, options.throwOnUnknown !== false);
  }

  if (node.type === "UnaryExpression") {
    const value = evaluateNode(node.argument, context, options);
    if (node.operator === "!") return !Boolean(value);
    if (node.operator === "-") return -toNumber(value, "unary -");
    if (node.operator === "+") return toNumber(value, "unary +");
    throw new Error(`Unsupported unary operator '${node.operator}'.`);
  }

  if (node.type === "BinaryExpression") {
    const left = evaluateNode(node.left, context, options);
    const right = evaluateNode(node.right, context, options);

    switch (node.operator) {
      case "+":
        return toNumber(left, "+") + toNumber(right, "+");
      case "-":
        return toNumber(left, "-") - toNumber(right, "-");
      case "*":
        return toNumber(left, "*") * toNumber(right, "*");
      case "/": {
        const denominator = toNumber(right, "/");
        if (denominator === 0) {
          throw new Error("Division by zero.");
        }
        return toNumber(left, "/") / denominator;
      }
      case "%": {
        const denominator = toNumber(right, "%");
        if (denominator === 0) {
          throw new Error("Modulo by zero.");
        }
        return toNumber(left, "%") % denominator;
      }
      case "^":
        return toNumber(left, "^") ** toNumber(right, "^");
      case ">":
        return toNumber(left, ">") > toNumber(right, ">");
      case ">=":
        return toNumber(left, ">=") >= toNumber(right, ">=");
      case "<":
        return toNumber(left, "<") < toNumber(right, "<");
      case "<=":
        return toNumber(left, "<=") <= toNumber(right, "<=");
      case "==":
        return left === right;
      case "!=":
        return left !== right;
      case "&&":
        return Boolean(left) && Boolean(right);
      case "||":
        return Boolean(left) || Boolean(right);
      default:
        throw new Error(`Unsupported operator '${node.operator}'.`);
    }
  }

  if (node.type === "CallExpression") {
    const fn = WHITELISTED_FUNCTIONS[node.callee];
    if (!fn) {
      throw new Error(`Function '${node.callee}' is not allowed.`);
    }
    const args = node.args.map((arg, index) => toNumber(evaluateNode(arg, context, options), `${node.callee} arg ${index + 1}`));
    return fn(...args);
  }

  throw new Error("Unsupported AST node.");
}

export function evaluateAst(ast: AstNode, context: EvalContext, options: EvalOptions = {}): unknown {
  return evaluateNode(ast, context, options);
}

export function evaluateExpression(expression: string, context: EvalContext, options: EvalOptions = {}): unknown {
  const ast = parseExpression(expression);
  return evaluateAst(ast, context, options);
}

export function evaluateNumberExpression(expression: string, context: EvalContext, options: EvalOptions = {}): number {
  const value = evaluateExpression(expression, context, options);
  return toNumber(value, expression);
}

export function evaluateBooleanExpression(expression: string, context: EvalContext, options: EvalOptions = {}): boolean {
  const value = evaluateExpression(expression, context, options);
  return Boolean(value);
}
