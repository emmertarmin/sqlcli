import { expect, test } from "bun:test";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { formatConnectionTable, formatConnections } from "../src/commands/connections.js";

const config = {
  version: 1,
  connections: {
    example: {
      server: "db.example.com",
      user: "sa",
      password: "secret",
      database: "master",
    },
  },
} as const;

test("connection list is concise and redacts verbose details", () => {
  const table = formatConnectionTable(config);
  expect(table).toContain("NAME");
  expect(table).toContain("example");
  expect(table).toContain("db.example.com");
  expect(table).toContain("master");
  expect(table).toContain("--verbose");
  expect(formatConnections(config).connections.example.password).toBe("*****");
});

test("connection add supports scripted creation", async () => {
  const root = join(process.cwd(), `.tmp-add-${crypto.randomUUID()}`);

  try {
    const proc = Bun.spawn({
      cmd: ["bun", "run", "src/index.ts", "connection", "add", "local", "--server", "localhost", "--database", "master", "--user", "sa", "--password-stdin"],
      cwd: process.cwd(),
      env: { ...process.env, XDG_CONFIG_HOME: root },
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    });
    proc.stdin.write("secret\n");
    proc.stdin.end();

    expect(await proc.exited).toBe(0);
    const saved = JSON.parse(await readFile(join(root, "sqlcli", "config.json"), "utf8"));
    expect(saved.connections.local).toMatchObject({ server: "localhost", port: 1433, database: "master", user: "sa" });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
