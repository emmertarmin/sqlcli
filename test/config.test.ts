import { expect, test } from "bun:test";
import { readFile, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { saveConfig } from "../src/config/load-config.js";

test("config saves canonically with private permissions", async () => {
  const previous = process.env.XDG_CONFIG_HOME;
  const root = join(process.cwd(), `.tmp-config-${crypto.randomUUID()}`);
  process.env.XDG_CONFIG_HOME = root;

  try {
    await saveConfig({
      version: 1,
      connections: {
        zeta: { server: "z", user: "u", password: "p", database: "d" },
        alpha: { server: "a", user: "u", password: "p", database: "d" },
      },
    });

    const path = join(root, "sqlcli", "config.json");
    const saved = await readFile(path, "utf8");
    expect(saved.indexOf('"alpha"')).toBeLessThan(saved.indexOf('"zeta"'));
    expect((await stat(path)).mode & 0o777).toBe(0o600);
  } finally {
    await rm(root, { recursive: true, force: true });
    if (previous === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = previous;
  }
});
