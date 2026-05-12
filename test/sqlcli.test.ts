import { expect, test } from "bun:test";

type JsonResult = {
  recordsets: Array<Array<Record<string, unknown>>>;
  rowsAffected: number[];
  output: Record<string, unknown>;
};

type PrerequisiteResult =
  | { ok: true }
  | { ok: false; message: string };

const COMMAND_TIMEOUT_MS = 5_000;
const PREREQUISITES = await ensurePrerequisites();

function uniqueTableName(suffix: string) {
  return `sqlcli_test_${suffix}_${Date.now()}_${crypto.randomUUID().replace(/-/g, "")}`;
}

function asSqlString(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

async function runCommand(cmd: string[], timeoutMs = COMMAND_TIMEOUT_MS) {
  const proc = Bun.spawn({
    cmd,
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
    env: process.env,
  });

  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    proc.kill();
  }, timeoutMs);

  try {
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);

    if (timedOut) {
      throw new Error(`Command timed out after ${timeoutMs}ms: ${cmd.join(" ")}`);
    }

    return { stdout, stderr, exitCode };
  } finally {
    clearTimeout(timeout);
  }
}

async function runSql(sql: string) {
  const result = await runCommand(["bun", "run", "src/index.ts", "query", "--output", "json", "--sql", sql]);

  if (result.exitCode !== 0) {
    throw new Error(`sqlcli failed with exit code ${result.exitCode}\nSQL: ${sql}\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  }

  return JSON.parse(result.stdout) as JsonResult;
}

async function tryRunSql(sql: string) {
  try {
    await runSql(sql);
  } catch {
    // best-effort cleanup
  }
}

async function ensurePrerequisites(): Promise<PrerequisiteResult> {
  try {
    const sessionStatus = await runCommand(["bun", "run", "src/index.ts", "session", "status"]);
    if (sessionStatus.exitCode !== 0) {
      return {
        ok: false,
        message: `Unable to check active session\n${sessionStatus.stderr || sessionStatus.stdout}`,
      };
    }

    const parsed = JSON.parse(sessionStatus.stdout) as { active: { connectionName: string } | null };
    if (!parsed.active) {
      return {
        ok: false,
        message: "No active sqlcli session found. Start one first with `bun run src/index.ts session start -c <name>`.",
      };
    }

    const probe = await runCommand(
      ["bun", "run", "src/index.ts", "query", "--output", "json", "--sql", "SELECT 1 AS [ready];"],
      5_000,
    );

    if (probe.exitCode !== 0) {
      return {
        ok: false,
        message: `Active session is not usable\n${probe.stderr || probe.stdout}`,
      };
    }

    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      message,
    };
  }
}

if (!PREREQUISITES.ok) {
  test("sqlcli test prerequisites are available", () => {
    throw new Error(PREREQUISITES.message);
  });
} else {
  test("create table and drop table", async () => {
    const tableName = uniqueTableName("create_drop");

    await tryRunSql(`IF OBJECT_ID(${asSqlString(`dbo.${tableName}`)}, 'U') IS NOT NULL DROP TABLE [dbo].[${tableName}];`);

    try {
      await runSql(`CREATE TABLE [dbo].[${tableName}] ([id] INT NOT NULL);`);

      const created = await runSql(`
        SELECT COLUMN_NAME AS [columnName]
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = ${asSqlString(tableName)}
        ORDER BY ORDINAL_POSITION;
      `);
      expect(created.recordsets[0]).toEqual([{ columnName: "id" }]);

      await runSql(`DROP TABLE [dbo].[${tableName}];`);

      const dropped = await runSql(`SELECT OBJECT_ID(${asSqlString(`dbo.${tableName}`)}, 'U') AS [objectId];`);
      expect(dropped.recordsets[0]).toEqual([{ objectId: null }]);
    } finally {
      await tryRunSql(`IF OBJECT_ID(${asSqlString(`dbo.${tableName}`)}, 'U') IS NOT NULL DROP TABLE [dbo].[${tableName}];`);
    }
  });

  test("add column and drop column", async () => {
    const tableName = uniqueTableName("column_ops");

    await tryRunSql(`IF OBJECT_ID(${asSqlString(`dbo.${tableName}`)}, 'U') IS NOT NULL DROP TABLE [dbo].[${tableName}];`);

    try {
      await runSql(`CREATE TABLE [dbo].[${tableName}] ([id] INT NOT NULL);`);
      await runSql(`ALTER TABLE [dbo].[${tableName}] ADD [note] NVARCHAR(100) NULL;`);

      const afterAdd = await runSql(`
        SELECT COLUMN_NAME AS [columnName]
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = ${asSqlString(tableName)}
        ORDER BY ORDINAL_POSITION;
      `);
      expect(afterAdd.recordsets[0]).toEqual([{ columnName: "id" }, { columnName: "note" }]);

      await runSql(`ALTER TABLE [dbo].[${tableName}] DROP COLUMN [note];`);

      const afterDrop = await runSql(`
        SELECT COLUMN_NAME AS [columnName]
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = ${asSqlString(tableName)}
        ORDER BY ORDINAL_POSITION;
      `);
      expect(afterDrop.recordsets[0]).toEqual([{ columnName: "id" }]);
    } finally {
      await tryRunSql(`IF OBJECT_ID(${asSqlString(`dbo.${tableName}`)}, 'U') IS NOT NULL DROP TABLE [dbo].[${tableName}];`);
    }
  });

  test("insert into and select", async () => {
    const tableName = uniqueTableName("insert_select");

    await tryRunSql(`IF OBJECT_ID(${asSqlString(`dbo.${tableName}`)}, 'U') IS NOT NULL DROP TABLE [dbo].[${tableName}];`);

    try {
      await runSql(`CREATE TABLE [dbo].[${tableName}] ([id] INT NOT NULL, [name] NVARCHAR(100) NOT NULL);`);

      const insertResult = await runSql(`INSERT INTO [dbo].[${tableName}] ([id], [name]) VALUES (1, 'alpha'), (2, 'beta');`);
      expect(insertResult.rowsAffected).toEqual([2]);

      const selectResult = await runSql(`SELECT [id], [name] FROM [dbo].[${tableName}] ORDER BY [id];`);
      expect(selectResult.recordsets[0]).toEqual([
        { id: 1, name: "alpha" },
        { id: 2, name: "beta" },
      ]);
    } finally {
      await tryRunSql(`IF OBJECT_ID(${asSqlString(`dbo.${tableName}`)}, 'U') IS NOT NULL DROP TABLE [dbo].[${tableName}];`);
    }
  });

  test("update", async () => {
    const tableName = uniqueTableName("update");

    await tryRunSql(`IF OBJECT_ID(${asSqlString(`dbo.${tableName}`)}, 'U') IS NOT NULL DROP TABLE [dbo].[${tableName}];`);

    try {
      await runSql(`CREATE TABLE [dbo].[${tableName}] ([id] INT NOT NULL, [name] NVARCHAR(100) NOT NULL);`);
      await runSql(`INSERT INTO [dbo].[${tableName}] ([id], [name]) VALUES (1, 'before');`);

      const updateResult = await runSql(`UPDATE [dbo].[${tableName}] SET [name] = 'after' WHERE [id] = 1;`);
      expect(updateResult.rowsAffected).toEqual([1]);

      const selectResult = await runSql(`SELECT [id], [name] FROM [dbo].[${tableName}] WHERE [id] = 1;`);
      expect(selectResult.recordsets[0]).toEqual([{ id: 1, name: "after" }]);
    } finally {
      await tryRunSql(`IF OBJECT_ID(${asSqlString(`dbo.${tableName}`)}, 'U') IS NOT NULL DROP TABLE [dbo].[${tableName}];`);
    }
  });

  test("delete", async () => {
    const tableName = uniqueTableName("delete");

    await tryRunSql(`IF OBJECT_ID(${asSqlString(`dbo.${tableName}`)}, 'U') IS NOT NULL DROP TABLE [dbo].[${tableName}];`);

    try {
      await runSql(`CREATE TABLE [dbo].[${tableName}] ([id] INT NOT NULL);`);
      await runSql(`INSERT INTO [dbo].[${tableName}] ([id]) VALUES (1), (2);`);

      const deleteResult = await runSql(`DELETE FROM [dbo].[${tableName}] WHERE [id] = 1;`);
      expect(deleteResult.rowsAffected).toEqual([1]);

      const selectResult = await runSql(`SELECT [id] FROM [dbo].[${tableName}] ORDER BY [id];`);
      expect(selectResult.recordsets[0]).toEqual([{ id: 2 }]);
    } finally {
      await tryRunSql(`IF OBJECT_ID(${asSqlString(`dbo.${tableName}`)}, 'U') IS NOT NULL DROP TABLE [dbo].[${tableName}];`);
    }
  });

  test("truncate table", async () => {
    const tableName = uniqueTableName("truncate");

    await tryRunSql(`IF OBJECT_ID(${asSqlString(`dbo.${tableName}`)}, 'U') IS NOT NULL DROP TABLE [dbo].[${tableName}];`);

    try {
      await runSql(`CREATE TABLE [dbo].[${tableName}] ([id] INT NOT NULL);`);
      await runSql(`INSERT INTO [dbo].[${tableName}] ([id]) VALUES (1), (2), (3);`);
      await runSql(`TRUNCATE TABLE [dbo].[${tableName}];`);

      const selectResult = await runSql(`SELECT COUNT(*) AS [rowCount] FROM [dbo].[${tableName}];`);
      expect(selectResult.recordsets[0]).toEqual([{ rowCount: 0 }]);
    } finally {
      await tryRunSql(`IF OBJECT_ID(${asSqlString(`dbo.${tableName}`)}, 'U') IS NOT NULL DROP TABLE [dbo].[${tableName}];`);
    }
  });
}
