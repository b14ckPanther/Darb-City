import { expect, it } from "vitest";
import { e2eDatabaseUrl } from "../../e2e/e2e-database";

const E2E = "postgresql://darb:darb@localhost:5433/darb_e2e";

it("uses E2E_DATABASE_URL when it names a throwaway database", () => {
  expect(e2eDatabaseUrl({ E2E_DATABASE_URL: E2E })).toBe(E2E);
  const test = "postgresql://u:p@db.local:5432/city_test?sslmode=disable";
  expect(e2eDatabaseUrl({ E2E_DATABASE_URL: test })).toBe(test);
});

it("refuses to run without E2E_DATABASE_URL, even when apps/api/.env holds DATABASE_URL", () => {
  expect(() => e2eDatabaseUrl({})).toThrow(/E2E_DATABASE_URL/);
  expect(() =>
    e2eDatabaseUrl({ DATABASE_URL: "postgresql://darb:darb@localhost:5433/darb_e2e" }),
  ).toThrow(/E2E_DATABASE_URL/);
});

it("refuses a database whose name does not end in _e2e or _test", () => {
  for (const name of ["darb", "darb_e2e_old", "e2e", "darb-test", "darb_testing", ""])
    expect(() =>
      e2eDatabaseUrl({ E2E_DATABASE_URL: `postgresql://darb:darb@localhost:5433/${name}` }),
    ).toThrow(/_e2e or _test/);
  expect(() => e2eDatabaseUrl({ E2E_DATABASE_URL: "not a url" })).toThrow(/_e2e or _test/);
});

it("in CI, accepts the job's own throwaway DATABASE_URL", () => {
  const ci = "postgresql://darb:darb@localhost:5433/darb";
  expect(e2eDatabaseUrl({ CI: "true", DATABASE_URL: ci })).toBe(ci);
  expect(e2eDatabaseUrl({ CI: "true", DATABASE_URL: ci, E2E_DATABASE_URL: E2E })).toBe(E2E);
  expect(() => e2eDatabaseUrl({ CI: "true" })).toThrow(/E2E_DATABASE_URL/);
  // Only CI=true (or 1) counts: CI=false is a local run.
  expect(() => e2eDatabaseUrl({ CI: "false", DATABASE_URL: ci })).toThrow(/E2E_DATABASE_URL/);
});
