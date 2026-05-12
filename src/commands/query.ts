import type { CommandDefinition } from "../cli/types.js";
import { runQuery, type OutputFormat, printQueryResult } from "../db/mssql.js";
import { sendSessionRequest } from "../session/ipc.js";
import { getActiveSessionState } from "./session.js";

async function readStatementFromStdin(): Promise<string> {
  if (process.stdin.isTTY) {
    return "";
  }

  let input = "";
  for await (const chunk of process.stdin) {
    input += String(chunk);
  }

  return input.trim();
}

export const queryCommand: CommandDefinition = {
  name: "query",
  aliases: ["q"],
  summary: "Execute a SQL statement",
  description:
    "Run a SQL statement against a configured connection, or against the active reusable session when --connection is omitted.",
  arguments: [
    {
      name: "statement",
      description: "SQL statement to execute",
      variadic: true,
    },
  ],
  flags: [
    {
      name: "connection",
      aliases: ["c"],
      type: "string",
      description: "Connection name from the XDG config file",
    },
    {
      name: "sql",
      aliases: ["s"],
      type: "string",
      description: "SQL statement to execute",
    },
    {
      name: "output",
      aliases: ["o"],
      type: "string",
      description: "Output format",
      defaultValue: "table",
      choices: ["table", "json"],
    },
  ],
  examples: [
    'sqlcli query --connection test --sql "SELECT @@VERSION;"',
    'sqlcli query --output json "SELECT 3 AS [three];"',
    'echo "SELECT @@VERSION;" | sqlcli query',
  ],
  execute: async ({ values, positionals }) => {
    const connectionName = typeof values.connection === "string" ? values.connection : undefined;

    const positionalStatement = positionals.join(" ");
    const statementFromArgs = typeof values.sql === "string" ? values.sql : positionalStatement;
    const stdinStatement = statementFromArgs ? "" : await readStatementFromStdin();
    const statement = statementFromArgs || stdinStatement;

    if (!statement) {
      throw new Error("Missing SQL statement: pass --sql <statement>, a positional SQL string, or pipe it via stdin");
    }

    const outputValue = values.output;
    const outputFormat: OutputFormat = outputValue === undefined || outputValue === "table"
      ? "table"
      : outputValue === "json"
        ? "json"
        : (() => {
            throw new Error(`Unsupported --output value: ${String(outputValue)} (expected: table or json)`);
          })();

    if (connectionName) {
      await runQuery(connectionName, statement, outputFormat);
      return;
    }

    const session = await getActiveSessionState();
    if (!session) {
      throw new Error("Missing required option --connection <name> (or start a session with `sqlcli session start --connection <name>`)");
    }

    const response = await sendSessionRequest(session.socketPath, {
      action: "query",
      statement,
    });
    if (!response.ok || !response.result) {
      throw new Error(response.ok ? "Session query did not return a result" : response.error);
    }

    printQueryResult(response.result, outputFormat);
  },
};
