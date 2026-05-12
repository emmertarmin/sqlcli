import { constants as fsConstants } from "node:fs";
import { access, mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { getConfigPath } from "./xdg.js";
import type { AppConfig } from "./types.js";

export async function ensureConfigDir() {
  await mkdir(dirname(getConfigPath()), { recursive: true });
}

export async function loadConfig(): Promise<AppConfig> {
  const configPath = getConfigPath();
  await access(configPath, fsConstants.R_OK);
  const raw = await readFile(configPath, "utf8");
  const config = JSON.parse(raw) as Partial<AppConfig>;

  if (!config.connections || typeof config.connections !== "object") {
    throw new Error(`Invalid config in ${configPath}: missing connections object`);
  }

  return config as AppConfig;
}
