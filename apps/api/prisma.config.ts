import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  // Neon: migrations need the direct (non-pooled) URL; the app uses the pooled one.
  datasource: { url: process.env["MIGRATE_DATABASE_URL"] ?? process.env["DATABASE_URL"] },
});
