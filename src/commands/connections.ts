import { loadConfig } from "../config/load-config.js";
import type { AppConfig, ConnectionConfig } from "../config/types.js";
import type { CommandDefinition } from "../cli/types.js";

function maskConnection(connection: ConnectionConfig, showPasswords: boolean): ConnectionConfig {
  return {
    ...connection,
    password: showPasswords ? connection.password : "*****",
  };
}

export function formatConnections(config: AppConfig, showPasswords: boolean) {
  return {
    connections: Object.fromEntries(
      Object.entries(config.connections).map(([name, connection]) => [name, maskConnection(connection, showPasswords)]),
    ),
  };
}

export const connectionListCommand: CommandDefinition = {
  name: "list",
  aliases: ["ls"],
  summary: "List configured connections",
  description: "Print configured connections from the XDG config file.",
  flags: [
    {
      name: "show-passwords",
      type: "boolean",
      description: "Show real passwords instead of masking them",
    },
  ],
  examples: ["sqlcli connection list", "sqlcli connection list --show-passwords"],
  execute: async ({ values }) => {
    const config = await loadConfig();
    const showPasswords = values["show-passwords"] === true;
    console.log(JSON.stringify(formatConnections(config, showPasswords), null, 2));
  },
};

export const connectionCommand: CommandDefinition = {
  name: "connection",
  aliases: ["connections", "conns"],
  summary: "Inspect and manage saved connections",
  description: "Commands for working with connection definitions stored in the XDG config file.",
  subcommands: [connectionListCommand],
};
