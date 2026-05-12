import { collectCommandFlags, getVisibleSubcommands, rootCommand } from "./registry.js";
import type { ArgumentDefinition, CommandDefinition, FlagDefinition } from "./types.js";

function formatArgument(argument: ArgumentDefinition): string {
  const base = argument.variadic ? `${argument.name}...` : argument.name;
  return argument.required ? `<${base}>` : `[${base}]`;
}

function formatFlag(flag: FlagDefinition): string {
  const aliases = (flag.aliases ?? []).map((alias) => (alias.length === 1 ? `-${alias}` : `--${alias}`));
  const label = ["--" + flag.name, ...aliases].join(", ");
  return `${label}${flag.type === "string" ? " <value>" : ""}`;
}

function formatFlagDetails(flag: FlagDefinition): string {
  const details: string[] = [];
  if (flag.required) {
    details.push("required");
  }
  if (flag.defaultValue !== undefined) {
    details.push(`default: ${String(flag.defaultValue)}`);
  }
  if (flag.choices && flag.choices.length > 0) {
    details.push(`choices: ${flag.choices.join(", ")}`);
  }
  return details.length > 0 ? ` (${details.join("; ")})` : "";
}

function printUsage(command: CommandDefinition, path: CommandDefinition[]) {
  const names = path.map((entry) => entry.name);
  const commandPath = names.length > 0 ? ` ${names.join(" ")}` : "";
  const executable = typeof command.execute === "function";
  const subcommands = getVisibleSubcommands(command);
  const hasOptions = collectCommandFlags(command).length > 0;
  const argumentList = (command.arguments ?? []).map(formatArgument).join(" ");

  console.log("Usage:");
  if (subcommands.length > 0) {
    console.log(`  sqlcli${commandPath} <subcommand>`);
  }
  if (executable) {
    const parts = [`sqlcli${commandPath}`];
    if (hasOptions) {
      parts.push("[options]");
    }
    if (argumentList) {
      parts.push(argumentList);
    }
    console.log(`  ${parts.join(" ")}`);
  }
}

function printArguments(command: CommandDefinition) {
  const argumentsList = command.arguments ?? [];
  if (argumentsList.length === 0) {
    return;
  }

  console.log();
  console.log("Arguments:");
  for (const argument of argumentsList) {
    console.log(`  ${formatArgument(argument)}`);
    console.log(`      ${argument.description}`);
  }
}

function printFlags(command: CommandDefinition) {
  const flags = collectCommandFlags(command).filter((flag) => flag.hidden !== true);
  if (flags.length === 0) {
    return;
  }

  console.log();
  console.log("Options:");
  for (const flag of flags) {
    console.log(`  ${formatFlag(flag)}`);
    console.log(`      ${flag.description}${formatFlagDetails(flag)}`);
  }
}

function printSubcommands(command: CommandDefinition, path: CommandDefinition[]) {
  const subcommands = getVisibleSubcommands(command);
  if (subcommands.length === 0) {
    return;
  }

  const prefix = path.map((entry) => entry.name).join(" ");

  console.log();
  console.log("Subcommands:");
  for (const subcommand of subcommands) {
    const label = prefix ? `${prefix} ${subcommand.name}` : subcommand.name;
    console.log(`  ${label} - ${subcommand.summary}`);
  }
}

function printExamples(command: CommandDefinition) {
  if (!command.examples || command.examples.length === 0) {
    return;
  }

  console.log();
  console.log("Examples:");
  for (const example of command.examples) {
    console.log(`  ${example}`);
  }
}

export function printCommandHelp(command: CommandDefinition, path: CommandDefinition[]) {
  const title = path.length === 0 ? rootCommand.name : `${rootCommand.name} ${path.map((entry) => entry.name).join(" ")}`;
  console.log(title);
  console.log();
  console.log(command.description ?? command.summary);
  console.log();
  printUsage(command, path);
  printArguments(command);
  printFlags(command);
  printSubcommands(command, path);
  printExamples(command);
}

export function printRootHelp() {
  printCommandHelp(rootCommand, []);
  console.log();
  console.log("Run `sqlcli <command> --help` for command-specific help.");
}
