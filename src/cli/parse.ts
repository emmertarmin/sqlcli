import { collectCommandFlags, resolveCommandPath } from "./registry.js";
import type { CommandDefinition, FlagDefinition, ParsedValues } from "./types.js";

export type ParsedCli = {
  command: CommandDefinition | undefined;
  path: CommandDefinition[];
  values: ParsedValues;
  positionals: string[];
};

function buildFlagMaps(flags: FlagDefinition[]) {
  const byLongName = new Map<string, FlagDefinition>();
  const byAlias = new Map<string, FlagDefinition>();

  for (const flag of flags) {
    byLongName.set(flag.name, flag);
    for (const alias of flag.aliases ?? []) {
      byAlias.set(alias, flag);
    }
  }

  return { byLongName, byAlias };
}

function parseFlagToken(arg: string, maps: ReturnType<typeof buildFlagMaps>) {
  if (arg.startsWith("--")) {
    const body = arg.slice(2);
    const [name, inlineValue] = body.split("=", 2);
    return {
      flag: maps.byLongName.get(name),
      inlineValue,
      displayName: `--${name}`,
    };
  }

  if (arg.startsWith("-") && arg.length > 1) {
    const alias = arg.slice(1);
    return {
      flag: maps.byAlias.get(alias),
      inlineValue: undefined,
      displayName: `-${alias}`,
    };
  }

  return {
    flag: undefined,
    inlineValue: undefined,
    displayName: arg,
  };
}

function parseValues(args: string[], flags: FlagDefinition[]) {
  const maps = buildFlagMaps(flags);
  const values: ParsedValues = {};
  const positionals: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--") {
      positionals.push(...args.slice(index + 1));
      break;
    }

    if (!arg.startsWith("-")) {
      positionals.push(arg);
      continue;
    }

    const { flag, inlineValue, displayName } = parseFlagToken(arg, maps);
    if (!flag) {
      throw new Error(`Unknown option: ${displayName}`);
    }

    if (flag.type === "boolean") {
      if (inlineValue !== undefined) {
        throw new Error(`Option ${displayName} does not take a value`);
      }

      values[flag.name] = true;
      continue;
    }

    const value = inlineValue ?? args[index + 1];
    if (value === undefined || value.startsWith("-")) {
      throw new Error(`Missing value for option ${displayName}`);
    }

    values[flag.name] = value;
    index += inlineValue === undefined ? 1 : 0;
  }

  return { values, positionals };
}

export function parseCli(args: string[]): ParsedCli {
  const resolved = resolveCommandPath(args);

  if (resolved.unknownTopLevelCommand) {
    throw new Error(`Unknown command: ${args[0]}`);
  }

  if (resolved.unknownCommand) {
    const unknownToken = args[resolved.consumed];
    const commandPath = resolved.path.map((entry) => entry.name).join(" ");
    throw new Error(`Unknown subcommand for ${commandPath}: ${unknownToken}`);
  }

  const command = resolved.command;
  const flags = collectCommandFlags(command);
  const parsed = parseValues(args.slice(resolved.consumed), flags);

  return {
    command,
    path: resolved.path,
    values: parsed.values,
    positionals: parsed.positionals,
  };
}
