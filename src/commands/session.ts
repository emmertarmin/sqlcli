import net from "node:net";
import { unlink } from "node:fs/promises";
import sql from "mssql";
import type { CommandDefinition, ParsedValues } from "../cli/types.js";
import { loadConfig } from "../config/load-config.js";
import { executeQuery, toMssqlConfig } from "../db/mssql.js";
import { sendSessionRequest } from "../session/ipc.js";
import {
  cleanupSessionArtifacts,
  clearSessionState,
  getSessionSocketPath,
  isSessionProcessAlive,
  loadSessionState,
  saveSessionState,
} from "../session/state.js";
import type { SessionRequest, SessionResponse, SessionState } from "../session/types.js";

function getStringValue(values: ParsedValues, name: string) {
  const value = values[name];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

async function getHealthySessionState() {
  const state = await loadSessionState();
  if (!state) {
    return undefined;
  }

  if (!isSessionProcessAlive(state.pid)) {
    await cleanupSessionArtifacts(state);
    return undefined;
  }

  try {
    const response = await sendSessionRequest(state.socketPath, { action: "status" });
    if (!response.ok || !response.state) {
      throw new Error(response.ok ? "Missing session state" : response.error);
    }

    return response.state;
  } catch {
    return undefined;
  }
}

export async function getActiveSessionState() {
  return await getHealthySessionState();
}

type SessionLogger = {
  info: (message: string) => void;
  error: (message: string) => void;
};

async function readRequest(socket: net.Socket): Promise<SessionRequest> {
  socket.setEncoding("utf8");

  return await new Promise<SessionRequest>((resolve, reject) => {
    let buffer = "";

    socket.on("data", (chunk: string) => {
      buffer += chunk;
      const newlineIndex = buffer.indexOf("\n");
      if (newlineIndex === -1) {
        return;
      }

      try {
        resolve(JSON.parse(buffer.slice(0, newlineIndex)) as SessionRequest);
      } catch (error) {
        reject(error);
      }
    });

    socket.on("end", () => {
      if (buffer.indexOf("\n") === -1) {
        reject(new Error("Client disconnected before sending a request"));
      }
    });

    socket.on("error", reject);
  });
}

async function writeResponse(socket: net.Socket, response: SessionResponse) {
  socket.write(`${JSON.stringify(response)}\n`);
  socket.end();
}

async function runSessionServer(connectionName: string, socketPath: string, logger?: SessionLogger) {
  const config = await loadConfig();
  const connection = config.connections[connectionName];
  if (!connection) {
    throw new Error(`Connection not found: ${connectionName}`);
  }

  if (process.platform !== "win32") {
    await unlink(socketPath).catch(() => undefined);
  }

  const pool = await new sql.ConnectionPool(toMssqlConfig(connection)).connect();
  const state: SessionState = {
    pid: process.pid,
    connectionName,
    socketPath,
    startedAt: new Date().toISOString(),
  };

  let shuttingDown = false;

  const server = net.createServer(async (socket) => {
    try {
      const request = await readRequest(socket);
      logger?.info(`request: ${request.action}`);

      if (request.action === "status") {
        await writeResponse(socket, { ok: true, state });
        return;
      }

      if (request.action === "stop") {
        logger?.info("stopping session");
        shuttingDown = true;
        await writeResponse(socket, { ok: true, stopped: true, state });
        server.close();
        return;
      }

      logger?.info(`executing query (${request.statement.length} chars)`);
      const startedAt = performance.now();
      const result = await executeQuery(pool, request.statement);
      const durationMs = performance.now() - startedAt;
      await writeResponse(socket, { ok: true, result });
      logger?.info(`query completed in ${durationMs.toFixed(1)}ms`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger?.error(`request failed: ${message}`);
      await writeResponse(socket, { ok: false, error: message }).catch(() => undefined);
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(socketPath, () => {
      server.off("error", reject);
      resolve();
    });
  });

  await saveSessionState(state);
  logger?.info(`session started`);
  logger?.info(`connection: ${connectionName}`);
  logger?.info(`socket: ${socketPath}`);
  logger?.info(`pid: ${process.pid}`);
  logger?.info("stop with Ctrl+C or `sqlcli session stop`");

  const cleanup = async () => {
    server.close();
    await pool.close().catch(() => undefined);
    await clearSessionState().catch(() => undefined);
    if (process.platform !== "win32") {
      await unlink(socketPath).catch(() => undefined);
    }
  };

  const handleSignal = async () => {
    logger?.info("received signal, shutting down");
    shuttingDown = true;
    await cleanup();
    process.exit(0);
  };

  process.on("SIGINT", handleSignal);
  process.on("SIGTERM", handleSignal);

  await new Promise<void>((resolve) => {
    server.on("close", resolve);
  });

  if (shuttingDown) {
    await cleanup();
    logger?.info("session stopped");
  }
}

export const sessionStatusCommand: CommandDefinition = {
  name: "status",
  summary: "Show the active session",
  description: "Print the active SQL session, if one exists.",
  examples: ["sqlcli session status"],
  execute: async () => {
    const state = await getHealthySessionState();
    console.log(JSON.stringify({ active: state ?? null }, null, 2));
  },
};

export const sessionStartCommand: CommandDefinition = {
  name: "start",
  summary: "Start a reusable SQL session",
  description: "Start a SQL session in the foreground and keep it running until stopped.",
  flags: [
    {
      name: "connection",
      aliases: ["c"],
      type: "string",
      description: "Connection name from the XDG config file",
      required: true,
    },
  ],
  examples: ["sqlcli session start --connection test"],
  execute: async ({ values }) => {
    const connectionName = getStringValue(values, "connection");
    if (!connectionName) {
      throw new Error("Missing required option --connection <name>");
    }

    const existingState = await getHealthySessionState();
    if (existingState) {
      if (existingState.connectionName === connectionName) {
        console.log(JSON.stringify({ active: existingState }, null, 2));
        return;
      }

      throw new Error(
        `A session is already active for connection ${JSON.stringify(existingState.connectionName)}. Stop it before starting a new one.`,
      );
    }

    const config = await loadConfig();
    if (!config.connections[connectionName]) {
      throw new Error(`Connection not found: ${connectionName}`);
    }

    await clearSessionState();
    const socketPath = getSessionSocketPath();

    await runSessionServer(connectionName, socketPath, {
      info: (message) => console.log(`[session] ${message}`),
      error: (message) => console.error(`[session] ${message}`),
    });
  },
};

export const sessionStopCommand: CommandDefinition = {
  name: "stop",
  summary: "Stop the active SQL session",
  description: "Stop the background SQL session and close its open connection.",
  examples: ["sqlcli session stop"],
  execute: async () => {
    const state = await getHealthySessionState();
    if (!state) {
      console.log(JSON.stringify({ stopped: false, reason: "no-active-session" }, null, 2));
      return;
    }

    const response = await sendSessionRequest(state.socketPath, { action: "stop" });
    if (!response.ok) {
      throw new Error(response.error);
    }

    await cleanupSessionArtifacts(state);
    console.log(JSON.stringify({ stopped: true }, null, 2));
  },
};

export const sessionDaemonCommand: CommandDefinition = {
  name: "daemon",
  hidden: true,
  summary: "Run the SQL session daemon",
  flags: [
    {
      name: "connection",
      aliases: ["c"],
      type: "string",
      description: "Connection name from the XDG config file",
      required: true,
    },
    {
      name: "socket-path",
      type: "string",
      description: "IPC socket path",
      required: true,
    },
  ],
  execute: async ({ values }) => {
    const connectionName = getStringValue(values, "connection");
    const socketPath = getStringValue(values, "socket-path");

    if (!connectionName || !socketPath) {
      throw new Error("Missing daemon configuration");
    }

    await runSessionServer(connectionName, socketPath);
  },
};

export const sessionCommand: CommandDefinition = {
  name: "session",
  summary: "Manage the reusable SQL session",
  description: "Start, stop, and inspect the single active reusable SQL session.",
  subcommands: [sessionStartCommand, sessionStopCommand, sessionStatusCommand, sessionDaemonCommand],
  examples: [
    "sqlcli session start --connection test",
    "sqlcli session status",
    "sqlcli session stop",
  ],
};
