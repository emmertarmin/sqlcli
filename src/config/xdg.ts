import { homedir } from "node:os";
import { join } from "node:path";

export function getConfigPath() {
  const baseDir = process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config");
  return join(baseDir, "sqlcli", "config.json");
}
