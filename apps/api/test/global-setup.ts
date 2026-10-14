import { execSync } from "node:child_process";
import { config } from "dotenv";
import pg from "pg";

export default async function setup(): Promise<void> {
  config({ path: new URL("../.env", import.meta.url) });
  const url = process.env["TEST_DATABASE_URL"];
  if (!url) throw new Error("TEST_DATABASE_URL is not set (see apps/api/.env.example)");
  const dbName = new URL(url).pathname.replace(/^\//, "");
  if (!dbName.endsWith("_test")) {
    throw new Error(
      `Refusing to run tests: TEST_DATABASE_URL database "${dbName}" must end with "_test" (the schema is dropped on every run)`,
    );
  }
  process.env["DATABASE_URL"] = url;
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  await client.query("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;");
  await client.end();
  execSync("pnpm exec prisma migrate deploy", {
    cwd: new URL("..", import.meta.url),
    // prisma.config.ts prefers MIGRATE_DATABASE_URL: pin it too, so tests never migrate another DB.
    env: { ...process.env, DATABASE_URL: url, MIGRATE_DATABASE_URL: url },
    stdio: "inherit",
  });
}
