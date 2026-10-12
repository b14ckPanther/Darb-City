import { expect, it } from "vitest";
import { loadConfig } from "./config.js";

it("reads and defaults the environment", () => {
  expect(loadConfig({ DATABASE_URL: "postgresql://a/b" })).toEqual({
    databaseUrl: "postgresql://a/b",
    port: 4000,
    webOrigin: "http://localhost:3000",
  });
});

it("refuses to start without a database", () => {
  expect(() => loadConfig({})).toThrow(/DATABASE_URL/);
});
