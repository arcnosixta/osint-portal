/**
 * Shared argument validator for segments. Each segment declares the *only*
 * flags, flag values and positional tokens it will forward, so unknown or
 * dangerous arguments never reach a subprocess.
 */

export type ValidateResult =
  | { args: string[]; positionals: string[] }
  | { error: string };

export interface ArgsContract {
  /** exact-match flags that take no value, e.g. `-z`, `+noall` */
  flags?: string[];
  /** flags that consume the following argument, mapped to a value pattern */
  values?: Record<string, RegExp>;
  /** optional pattern for positional tokens (not flags) */
  positional?: RegExp;
  /** max number of positional tokens (default unlimited) */
  maxPositional?: number;
}

export function validateArgs(
  args: string[],
  contract: ArgsContract,
  toolName: string,
  valueLabels?: Record<string, string>,
): ValidateResult {
  const flags = new Set(contract.flags ?? []);
  const out: string[] = [];
  const positionals: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const a = args[i];

    if (flags.has(a)) {
      out.push(a);
      continue;
    }

    const valueFlag = Object.keys(contract.values ?? {}).find((f) => a === f);
    if (valueFlag) {
      const value = args[i + 1];
      const pattern = contract.values![valueFlag];
      if (value === undefined) {
        return { error: `argument "${a}" requires a value` };
      }
      if (!pattern.test(value)) {
        const label = valueLabels?.[valueFlag] ?? "value";
        return { error: `invalid ${label} for "${a}": "${value}"` };
      }
      out.push(a, value);
      i++;
      continue;
    }

    if (contract.positional && contract.positional.test(a)) {
      if (contract.maxPositional !== undefined && positionals.length >= contract.maxPositional) {
        return { error: `too many arguments for ${toolName}` };
      }
      positionals.push(a);
      continue;
    }

    return { error: `argument not allowed for ${toolName}: "${a}"` };
  }

  return { args: out, positionals };
}