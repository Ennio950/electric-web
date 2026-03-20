export type WhitelistedFn = (...args: number[]) => number;

function assertArgs(name: string, args: number[], minArgs = 1): void {
  if (args.length < minArgs) {
    throw new Error(`Function '${name}' requires at least ${minArgs} argument(s).`);
  }
  args.forEach((arg, index) => {
    if (!Number.isFinite(arg)) {
      throw new Error(`Function '${name}' received non-numeric argument at position ${index + 1}.`);
    }
  });
}

export const WHITELISTED_FUNCTIONS: Record<string, WhitelistedFn> = {
  min: (...args: number[]) => {
    assertArgs("min", args, 1);
    return Math.min(...args);
  },
  max: (...args: number[]) => {
    assertArgs("max", args, 1);
    return Math.max(...args);
  },
  ceil: (...args: number[]) => {
    assertArgs("ceil", args, 1);
    return Math.ceil(args[0]);
  },
  floor: (...args: number[]) => {
    assertArgs("floor", args, 1);
    return Math.floor(args[0]);
  },
  round: (...args: number[]) => {
    assertArgs("round", args, 1);
    if (args.length > 1) {
      const digits = Math.max(0, Math.floor(args[1]));
      const factor = 10 ** digits;
      return Math.round(args[0] * factor) / factor;
    }
    return Math.round(args[0]);
  },
  clamp: (...args: number[]) => {
    assertArgs("clamp", args, 3);
    return Math.min(Math.max(args[0], args[1]), args[2]);
  },
  abs: (...args: number[]) => {
    assertArgs("abs", args, 1);
    return Math.abs(args[0]);
  }
};
