import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [swc.vite({ module: { type: "es6" } })],
  test: {
    include: ["src/**/*.test.ts"],
    globalSetup: ["test/global-setup.ts"],
    // Tests use their own Redis database (test/redis-db.ts), never the dev API's keys.
    setupFiles: ["test/redis-env.ts"],
    fileParallelism: false,
    env: {
      // Only the queue test runs a search-index worker (it turns this back on itself).
      SEARCH_INDEX_WORKER: "false",
      // Never the network, even with real keys in apps/api/.env: dotenv never overrides these
      // (src/ai/offline-providers.test.ts checks it).
      INTENT_PROVIDER: "recorded",
      EMBEDDING_PROVIDER: "hash",
      // No contact mail leaves a test run (src/inquiries/inquiries.test.ts sets a key and mocks fetch).
      RESEND_API_KEY: "",
      // Admin tests sign in with fake tokens (src/auth/fake-token-verifier.ts).
      AUTH_VERIFIER: "fake",
      ADMIN_EMAILS: "admin@darb.test",
    },
  },
});
