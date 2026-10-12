import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [swc.vite({ module: { type: "es6" } })],
  test: {
    include: ["src/**/*.test.ts"],
    globalSetup: ["test/global-setup.ts"],
    fileParallelism: false,
    // Only the queue test runs a search-index worker (it turns this back on itself).
    env: { SEARCH_INDEX_WORKER: "false" },
  },
});
