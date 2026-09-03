import { createInterface } from "node:readline/promises";
import { loadConfig, saveConfig } from "../config/load-config.js";
import type { AppConfig, ConnectionConfig } from "../config/types.js";
import type { CommandDefinition } from "../cli/types.js";

function maskConnection(connection: ConnectionConfig): ConnectionConfig {
  return {
    ...connection,
    password: "*****",
  };
}

export function formatConnections(config: AppConfig) {
  return {
    connections: Object.fromEntries(
      Object.entries(config.connections).map(([name, connection]) => [name, maskConnection(connection)]),
    ),
  };
}

export function formatConnectionTable(config: AppConfig): string {
  const rows = Object.entries(config.connections).map(([name, connection]) => [name, connection.server, connection.database]);
  const widths = ["NAME", "SERVER", "DATABASE"].map((header, index) =>
    Math.max(header.length, ...rows.map((row) => row[index].length)),
  );
  const formatRow = (row: string[]) => row.map((value, index) => value.padEnd(widths[index])).join("  ").trimEnd();

  return [formatRow(["NAME", "SERVER", "DATABASE"]), ...rows.map(formatRow), "", "Use --verbose for full connection details."].join("\n");
}

export const connectionListCommand: CommandDefinition = {
  name: "list",
  aliases: ["ls"],
  summary: "List configured connections",
  description: "Print configured connections from the XDG config file.",
  flags: [
    {
      name: "verbose",
      type: "boolean",
      description: "Show full connection details",
    },
  ],
  examples: ["sqlcli connection list", "sqlcli connection list --verbose"],
  execute: async ({ values }) => {
    const config = await loadConfig();
    if (values.verbose === true) {
      console.log(JSON.stringify(formatConnections(config), null, 2));
      return;
    }
    console.log(formatConnectionTable(config));
  },
};

async function promptForMissing(values: Record<string, string | boolean | undefined>) {
  const missing = (["server", "database", "user"] as const).filter(
    (name) => typeof values[name] !== "string" || !values[name],
  );
  if (values["password-stdin"] === true && missing.length > 0) {
    throw new Error("--password-stdin requires --server, --database, and --user");
  }
  if (missing.length === 0) return;

  const labels = { server: "Server", database: "Database", user: "User" };
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  try {
    for (const name of missing) {
      const value = await readline.question(`${labels[name]}: `);
      if (!value) throw new Error(`Missing required value ${name}`);
      values[name] = value;
    }
  } finally {
    readline.close();
  }
}

async function promptForPassword() {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function") {
    throw new Error("Password prompt requires a terminal; use --password-stdin");
  }
  process.stdout.write("Password: ");
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise<string>((resolve, reject) => {
    let password = "";
    const finish = (error?: Error) => {
      process.stdin.off("data", onData);
      process.stdin.setRawMode(false);
      process.stdout.write("\n");
      if (error) reject(error);
      else resolve(password);
    };
    const onData = (chunk: Buffer | string) => {
      for (const character of String(chunk)) {
        if (character === "\r" || character === "\n") return finish();
        if (character === "\u0003") return finish(new Error("Password prompt cancelled"));
        if (character === "\u007f") password = password.slice(0, -1);
        else password += character;
      }
    };
    process.stdin.on("data", onData);
  });
}

async function readPasswordFromStdin() {
  let password = "";
  for await (const chunk of process.stdin) password += String(chunk);
  return password.replace(/\r?\n$/, "");
}

export const connectionAddCommand: CommandDefinition = {
  name: "add",
  summary: "Add a saved connection",
  description: "Add a connection from flags or interactive prompts.",
  arguments: [{ name: "name", description: "Connection name", required: true }],
  flags: [
    { name: "server", type: "string", description: "SQL Server host" },
    { name: "database", type: "string", description: "Database name" },
    { name: "user", type: "string", description: "SQL Server user" },
    { name: "password-stdin", type: "boolean", description: "Read the password from stdin" },
    { name: "port", type: "string", description: "SQL Server port", defaultValue: "1433" },
    { name: "no-encrypt", type: "boolean", description: "Disable connection encryption" },
    { name: "no-trust-server-certificate", type: "boolean", description: "Do not trust the server certificate" },
    { name: "force", type: "boolean", description: "Replace an existing connection" },
  ],
  examples: ["sqlcli connection add local --server localhost --database master --user sa --password-stdin"],
  execute: async ({ values, positionals }) => {
    const name = positionals[0];
    if (!name || positionals.length > 1) throw new Error("Expected exactly one connection name");

    let config;
    try {
      config = await loadConfig();
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
      config = { version: 1 as const, connections: {} };
    }
    if (config.connections[name] && values.force !== true) {
      throw new Error(`Connection already exists: ${name} (use --force to replace it)`);
    }

    await promptForMissing(values);
    const password = values["password-stdin"] === true
      ? await readPasswordFromStdin()
      : await promptForPassword();
    if (!password) throw new Error("Missing required value password");
    const port = values.port === undefined ? 1433 : Number(values.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid port");
    const encrypt = values["no-encrypt"] === true ? false : true;
    const trustServerCertificate = values["no-trust-server-certificate"] === true ? false : true;

    config.connections[name] = {
      server: values.server as string,
      port,
      user: values.user as string,
      password,
      database: values.database as string,
      options: { encrypt, trustServerCertificate },
    };
    await saveConfig(config);
    console.log(`Connection added: ${name}`);
  },
};

export const connectionCommand: CommandDefinition = {
  name: "connection",
  aliases: ["connections", "conns"],
  summary: "Inspect and manage saved connections",
  description: "Commands for working with connection definitions stored in the XDG config file.",
  subcommands: [connectionListCommand, connectionAddCommand],
};
