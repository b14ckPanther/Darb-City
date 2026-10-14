/**
 * The database e2e writes to. admin.spec creates, publishes and suspends businesses and leaves audit
 * rows, so e2e never falls back to apps/api/.env (the owner's dev data): it needs E2E_DATABASE_URL
 * naming a database that ends in _e2e or _test. CI (CI=true) may instead use the job's own
 * throwaway DATABASE_URL.
 */
export function e2eDatabaseUrl(env: Record<string, string | undefined>): string {
  const ci = env["CI"] === "true" || env["CI"] === "1";
  const url = env["E2E_DATABASE_URL"] || (ci ? env["DATABASE_URL"] : undefined);
  if (!url)
    throw new Error(
      "e2e writes to its database: set E2E_DATABASE_URL to a throwaway one, e.g. " +
        "postgresql://darb:darb@localhost:5433/darb_e2e (migrated and seeded first).",
    );
  if (ci && !env["E2E_DATABASE_URL"]) return url;
  if (!/(_e2e|_test)$/.test(databaseName(url)))
    throw new Error(
      "E2E_DATABASE_URL must name a throwaway database whose name ends in _e2e or _test.",
    );
  return url;
}

function databaseName(url: string): string {
  try {
    return decodeURIComponent(new URL(url).pathname.replace(/^\//, ""));
  } catch {
    return "";
  }
}
