import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

/** Runs against the seeded dev database (DATABASE_URL), never the disposable test database. */
export default defineConfig({
  plugins: [swc.vite({ module: { type: "es6" } })],
  test: { include: ["quality/**/*.test.ts"], fileParallelism: false, testTimeout: 60_000 },
});
