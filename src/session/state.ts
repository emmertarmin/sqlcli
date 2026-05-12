import { constants as fsConstants } from "node:fs";
import { access, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { getConfigPath } from "../config/xdg.js";
import type { SessionState } from "./types.js";

function getSessionBaseDir() {
  return dirname(getConfigPath());
}

export function getSessionStatePath() {
  return join(getSessionBaseDir(), "session.json");
}

export function getSessionSocketPath() {
  if (process.platform === "win32") {
    const hash = createHash("sha1").update(getConfigPath()).digest("hex");
    return `\\\\.\\pipe\\sqlcli-${hash}`;
  }

  return join(getSessionBaseDir(), "session.sock");
}

export async function loadSessionState(): Promise<SessionState | undefined> {
  try {
    await access(getSessionStatePath(), fsConstants.R_OK);
  } catch {
    return undefined;
  }

  const raw = await readFile(getSessionStatePath(), "utf8");
  return JSON.parse(raw) as SessionState;
}

export async function saveSessionState(state: SessionState) {
  await writeFile(getSessionStatePath(), JSON.stringify(state, null, 2));
}

export async function clearSessionState() {
  await rm(getSessionStatePath(), { force: true });
}

export function isSessionProcessAlive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export async function cleanupSessionArtifacts(state: SessionState) {
  await clearSessionState();

  if (process.platform !== "win32") {
    await unlink(state.socketPath).catch(() => undefined);
  }
}
