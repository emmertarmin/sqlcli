import { expect, test } from "bun:test";
import { formatQueryResult } from "../src/db/mssql.js";
import type { QueryExecutionResult } from "../src/session/types.js";

function result(recordsets: QueryExecutionResult["recordsets"]): QueryExecutionResult {
  return {
    ok: true,
    recordsets,
    rowsAffected: [],
    output: {},
  };
}

test("csv output escapes quotes, commas, newlines, and whitespace", () => {
  expect(
    formatQueryResult(
      result([[{ quoted: 'hello, "world"', multiline: "line1\nline2", padded: " hello " }]]),
      "csv",
    ),
  ).toBe('quoted,multiline,padded\n"hello, ""world""","line1\nline2"," hello "');
});
