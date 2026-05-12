import sql from "mssql";
import { loadConfig } from "../config/load-config.js";
import type { ConnectionConfig } from "../config/types.js";
import type { QueryExecutionResult } from "../session/types.js";

function isIpAddress(value: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(value);
}

export function toMssqlConfig(connection: ConnectionConfig): sql.config {
  const trustServerCertificate = connection.options?.trustServerCertificate ?? false;

  return {
    server: connection.server,
    port: connection.port,
    user: connection.user,
    password: connection.password,
    database: connection.database,
    connectionTimeout: connection.connectionTimeoutMs,
    requestTimeout: connection.requestTimeoutMs,
    options: {
      encrypt: connection.options?.encrypt ?? true,
      trustServerCertificate,
      serverName:
        connection.options?.serverName ??
        (trustServerCertificate && isIpAddress(connection.server) ? "localhost" : undefined),
    },
  };
}

export type OutputFormat = "table" | "json";

export async function executeQuery(pool: sql.ConnectionPool, statement: string): Promise<QueryExecutionResult> {
  const result = await pool.request().query(statement);

  return {
    ok: true,
    recordset: (result.recordset ?? []) as Array<Record<string, unknown>>,
    recordsets: (result.recordsets ?? []) as Array<Array<Record<string, unknown>>>,
    rowsAffected: result.rowsAffected,
    output: result.output,
  };
}

export function formatQueryResult(result: QueryExecutionResult, outputFormat: OutputFormat = "table") {
  if (outputFormat === "json") {
    return JSON.stringify(result, null, 2);
  }

  const firstRecordset = result.recordset ?? [];
  if (firstRecordset.length > 0) {
    console.table(firstRecordset);
    return undefined;
  }

  return JSON.stringify({
    rowsAffected: result.rowsAffected,
    output: result.output,
  });
}

export function printQueryResult(result: QueryExecutionResult, outputFormat: OutputFormat = "table") {
  const formatted = formatQueryResult(result, outputFormat);
  if (formatted !== undefined) {
    console.log(formatted);
  }
}

export async function runQuery(connectionName: string, statement: string, outputFormat: OutputFormat = "table") {
  const config = await loadConfig();
  const connection = config.connections[connectionName];

  if (!connection) {
    throw new Error(`Connection not found: ${connectionName}`);
  }

  const pool = await new sql.ConnectionPool(toMssqlConfig(connection)).connect();
  try {
    const result = await executeQuery(pool, statement);
    printQueryResult(result, outputFormat);
  } finally {
    await pool.close();
  }
}
