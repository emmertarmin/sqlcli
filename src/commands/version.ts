import type { CommandDefinition } from "../cli/types.js";
import { printVersion } from "../version.js";

export const versionCommand: CommandDefinition = {
  name: "version",
  aliases: ["v"],
  summary: "Show version",
  description: "Print the installed sqlcli version.",
  examples: ["sqlcli version", "sqlcli --version"],
  execute: async () => {
    printVersion();
  },
};
