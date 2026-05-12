import { expect, test } from "bun:test";

async function runCli(args: string[]) {
  const proc = Bun.spawn({
    cmd: ["bun", "run", "src/index.ts", ...args],
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
    env: process.env,
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  return { stdout, stderr, exitCode };
}

test("sqlcli --help shows top-level help", async () => {
  const result = await runCli(["--help"]);

  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain("sqlcli");
  expect(result.stdout).toContain("Subcommands:");
  expect(result.stdout).toContain("query - Execute a SQL statement");
  expect(result.stdout).toContain("connection - Inspect and manage saved connections");
  expect(result.stdout).toContain("session - Manage the reusable SQL session");
});

test("group help is available on subcommands", async () => {
  const result = await runCli(["connection", "--help"]);

  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain("sqlcli connection");
  expect(result.stdout).toContain("connection list - List configured connections");
});

test("session help is available on subcommands", async () => {
  const result = await runCli(["session", "--help"]);

  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain("sqlcli session");
  expect(result.stdout).toContain("session start - Start a reusable SQL session");
  expect(result.stdout).not.toContain("--detach");
  expect(result.stdout).toContain("session stop - Stop the active SQL session");
  expect(result.stdout).toContain("session status - Show the active session");
});

test("command-specific flags are rejected on other commands", async () => {
  const result = await runCli(["connection", "list", "--output", "json"]);

  expect(result.exitCode).toBe(1);
  expect(result.stderr).toContain("Unknown option: --output");
});

test("unknown commands do not fall through to query", async () => {
  const result = await runCli(["wat"]);

  expect(result.exitCode).toBe(1);
  expect(result.stderr).toContain("Unknown command: wat");
});
