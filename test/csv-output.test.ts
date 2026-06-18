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

test("csv output includes headers and rows", () => {
  expect(formatQueryResult(result([[{ id: 1, text: "hello" }]]), "csv")).toBe("id,text\n1,hello");
});

test("csv output escapes quotes, commas, newlines, and whitespace", () => {
  expect(
    formatQueryResult(
      result([[{ quoted: 'hello, "world"', multiline: "line1\nline2", padded: " hello " }]]),
      "csv",
    ),
  ).toBe('quoted,multiline,padded\n"hello, ""world""","line1\nline2"," hello "');
});

test("csv output prints no results for empty resultsets", () => {
  expect(formatQueryResult(result([[]]), "csv")).toBe("No results");
});

test("csv output separates multiple resultsets with a blank line", () => {
  expect(formatQueryResult(result([[{ one: 1 }], [{ two: 2 }]]), "csv")).toBe("one\n1\n\ntwo\n2");
});
