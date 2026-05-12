import { printCommandHelp, printRootHelp } from "../cli/help.js";
import { resolveCommandPathFromNames } from "../cli/registry.js";
import type { CommandDefinition } from "../cli/types.js";

export const helpCommand: CommandDefinition = {
  name: "help",
  aliases: ["h"],
  summary: "Show help",
  description: "Show top-level help or help for a specific command path.",
  arguments: [
    {
      name: "command",
      description: "Command path to inspect",
      variadic: true,
    },
  ],
  examples: ["sqlcli help", "sqlcli help query", "sqlcli help connection list"],
  execute: async ({ positionals }) => {
    if (positionals.length === 0) {
      printRootHelp();
      return;
    }

    const resolved = resolveCommandPathFromNames(positionals);
    if (!resolved.command) {
      throw new Error(`Unknown command: ${positionals.join(" ")}`);
    }

    printCommandHelp(resolved.command, resolved.path);
  },
};
