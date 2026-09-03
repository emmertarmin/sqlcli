import { constants as fsConstants } from "node:fs";
import { randomUUID } from "node:crypto";
import { access, chmod, mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { getConfigPath } from "./xdg.js";
import type { AppConfig, ConnectionConfig } from "./types.js";

type ConfigDocument = {
  version: number;
  connections: Record<string, ConnectionConfig>;
};

type ConfigMigration = (config: ConfigDocument) => ConfigDocument;

const CURRENT_CONFIG_VERSION = 1;
const migrations: Record<number, ConfigMigration> = {
  0: (config) => ({ ...config, version: 1 }),
};

export async function ensureConfigDir() {
  await mkdir(dirname(getConfigPath()), { recursive: true });
}

function formatConfig(config: AppConfig) {
  const names = Object.keys(config.connections).sort();
  const entries = names.map((name, index) => {
    const comma = index < names.length - 1 ? "," : "";
    return `    ${JSON.stringify(name)}: ${JSON.stringify(config.connections[name])}${comma}`;
  });

  return [
    "{",
    `  \"version\": ${config.version},`,
    '  "connections": {',
    ...entries,
    "  }",
    "}",
    "",
  ].join("\n");
}

export async function saveConfig(config: AppConfig) {
  const configPath = getConfigPath();
  await mkdir(dirname(configPath), { recursive: true });
  const tempPath = `${configPath}.${process.pid}.${randomUUID()}.tmp`;

  try {
    await writeFile(tempPath, formatConfig(config), { encoding: "utf8", mode: 0o600, flag: "wx" });
    await chmod(tempPath, 0o600);
    await rename(tempPath, configPath);
  } catch (error) {
    await unlink(tempPath).catch(() => undefined);
    throw error;
  }
}

export async function loadConfig(): Promise<AppConfig> {
  const configPath = getConfigPath();
  await access(configPath, fsConstants.R_OK);
  const raw = await readFile(configPath, "utf8");
  const config = JSON.parse(raw) as {
    version?: number;
    connections?: Record<string, ConnectionConfig>;
  };

  if (!config.connections || typeof config.connections !== "object" || Array.isArray(config.connections)) {
    throw new Error(`Invalid config in ${configPath}: missing connections object`);
  }

  const originalVersion = config.version;
  let migrated: ConfigDocument = {
    version: originalVersion ?? 0,
    connections: config.connections,
  };
  while (migrated.version < CURRENT_CONFIG_VERSION) {
    const migrate = migrations[migrated.version];
    if (!migrate) throw new Error(`Unsupported config version ${migrated.version} in ${configPath}`);
    migrated = migrate(migrated);
  }
  if (migrated.version !== CURRENT_CONFIG_VERSION) {
    throw new Error(`Unsupported config version ${migrated.version} in ${configPath}`);
  }

  const result = migrated as AppConfig;
  if (originalVersion !== result.version) await saveConfig(result);
  return result;
}
