import { expect, test } from "bun:test";
import { formatConnections } from "../src/commands/connections.js";

test("connections command masks passwords by default", () => {
  const result = formatConnections(
    {
      connections: {
        example: {
          server: "db.example.com",
          user: "sa",
          password: "secret",
          database: "master",
        },
      },
    },
    false,
  );

  expect(result).toEqual({
    connections: {
      example: {
        server: "db.example.com",
        user: "sa",
        password: "*****",
        database: "master",
      },
    },
  });
});

test("connections command can show passwords", () => {
  const result = formatConnections(
    {
      connections: {
        example: {
          server: "db.example.com",
          user: "sa",
          password: "secret",
          database: "master",
        },
      },
    },
    true,
  );

  expect(result.connections.example.password).toBe("secret");
});
