import { expect, it } from "vitest";
import { loadConfig } from "./config.js";

const base = { DATABASE_URL: "postgresql://a/b" };

it("reads and defaults the environment", () => {
  const config = loadConfig(base);
  expect(config).toMatchObject({
    databaseUrl: "postgresql://a/b",
    port: 4000,
    webOrigin: "http://localhost:3000",
    search: {
      redisUrl: "redis://localhost:6380",
      trustProxy: 0,
      proxyKey: null,
      rateLimit: 30,
      resultsRateLimit: 120,
      intentProvider: "off",
      intentModel: "claude-haiku-5-5",
      intentTimeoutMs: 1500,
      anthropicApiKey: null,
      embeddingProvider: "hash",
      embeddingModel: "voyage-4-lite",
      voyageApiKey: null,
      indexWorker: true,
    },
  });
  expect(config.search.ipSalt).toMatch(/^[0-9a-f]{32}$/);
});

it("turns providers on when their keys are present", () => {
  const config = loadConfig({ ...base, ANTHROPIC_API_KEY: "k1", VOYAGE_API_KEY: "k2" });
  expect(config.search.intentProvider).toBe("anthropic");
  expect(config.search.embeddingProvider).toBe("voyage");
});

it("refuses a real provider without its key", () => {
  expect(() => loadConfig({ ...base, INTENT_PROVIDER: "anthropic" })).toThrow(/ANTHROPIC_API_KEY/);
  expect(() => loadConfig({ ...base, EMBEDDING_PROVIDER: "voyage" })).toThrow(/VOYAGE_API_KEY/);
});

it("refuses to start without a database", () => {
  expect(() => loadConfig({})).toThrow(/DATABASE_URL/);
});

it("refuses the example proxy key in production", () => {
  const dev = { ...base, SEARCH_PROXY_KEY: "dev-proxy-key" };
  expect(() => loadConfig({ ...dev, NODE_ENV: "production" })).toThrow(/SEARCH_PROXY_KEY/);
  expect(loadConfig(dev).search.proxyKey).toBe("dev-proxy-key");
  expect(
    loadConfig({ ...base, NODE_ENV: "production", SEARCH_PROXY_KEY: "a-real-secret" }).search
      .proxyKey,
  ).toBe("a-real-secret");
});
