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

test("command-specific flags are rejected on other commands", async () => {
  const result = await runCli(["connection", "list", "--sql", "SELECT 1"]);

  expect(result.exitCode).toBe(1);
  expect(result.stderr).toContain("Unknown option");
});

test("unknown commands do not fall through to query", async () => {
  const result = await runCli(["wat"]);

  expect(result.exitCode).toBe(1);
  expect(result.stderr).toContain("Unknown command: wat");
});
