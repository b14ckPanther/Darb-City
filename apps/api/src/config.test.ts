import { expect, it } from "vitest";
import { loadConfig } from "./config.js";

const base = { DATABASE_URL: "postgresql://a/b" };
const long = "x".repeat(32);

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
      clickRateLimit: 120,
      intentProvider: "off",
      intentModel: "claude-haiku-5-5",
      intentTimeoutMs: 1500,
      anthropicApiKey: null,
      embeddingProvider: "hash",
      embeddingModel: "voyage-4-lite",
      voyageApiKey: null,
      indexWorker: true,
      reportKey: null,
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

it("reads the report key; blank is unset", () => {
  expect(loadConfig({ ...base, SEARCH_REPORT_KEY: "r-key" }).search.reportKey).toBe("r-key");
  expect(loadConfig({ ...base, SEARCH_REPORT_KEY: "  " }).search.reportKey).toBeNull();
});

it("refuses to start without a database", () => {
  expect(() => loadConfig({})).toThrow(/DATABASE_URL/);
});

it("refuses the example proxy key in production", () => {
  const dev = { ...base, SEARCH_PROXY_KEY: "dev-proxy-key" };
  expect(() => loadConfig({ ...dev, NODE_ENV: "production" })).toThrow(/SEARCH_PROXY_KEY/);
  expect(loadConfig(dev).search.proxyKey).toBe("dev-proxy-key");
  expect(
    loadConfig({ ...base, NODE_ENV: "production", SEARCH_PROXY_KEY: long, IP_HASH_SALT: long })
      .search.proxyKey,
  ).toBe(long);
});

const prod = {
  ...base,
  NODE_ENV: "production",
  SEARCH_PROXY_KEY: long,
  IP_HASH_SALT: long,
};

it("defaults the Plan 4 settings", () => {
  const config = loadConfig(base);
  expect(config.auth).toEqual({
    verifier: "off",
    clerkSecretKey: null,
    clerkJwtKey: null,
    authorizedParties: [],
    adminEmails: [],
  });
  expect(config.admin).toEqual({ revalidateUrl: null, revalidateSecret: null });
  expect(config.search).toMatchObject({
    modelCallsPerMinute: 60,
    modelCallsPerDay: 5000,
    negativeCacheSeconds: 3600,
    suggestRateLimit: 240,
    logRetentionDays: 90,
  });
  expect(config.production).toBe(false);
});

it("reads Clerk, the allowlist and revalidation", () => {
  const config = loadConfig({
    ...base,
    CLERK_SECRET_KEY: "sk_test_1",
    CLERK_AUTHORIZED_PARTIES: "https://darb.co.il, https://www.darb.co.il",
    ADMIN_EMAILS: "Founder@Darb.co.il ,ops@darb.co.il",
    REVALIDATE_URL: "http://localhost:3000/api/revalidate",
    REVALIDATE_SECRET: "s",
  });
  expect(config.auth.verifier).toBe("clerk");
  expect(config.auth.authorizedParties).toEqual(["https://darb.co.il", "https://www.darb.co.il"]);
  expect(config.auth.adminEmails).toEqual(["founder@darb.co.il", "ops@darb.co.il"]);
  expect(config.admin.revalidateUrl).toBe("http://localhost:3000/api/revalidate");
});

it("refuses weak or missing production secrets", () => {
  expect(loadConfig(prod).production).toBe(true);
  expect(() => loadConfig({ ...prod, SEARCH_PROXY_KEY: "short" })).toThrow(/SEARCH_PROXY_KEY/);
  expect(() => loadConfig({ ...prod, SEARCH_PROXY_KEY: undefined })).toThrow(/SEARCH_PROXY_KEY/);
  expect(() => loadConfig({ ...prod, IP_HASH_SALT: undefined })).toThrow(/IP_HASH_SALT/);
  expect(() => loadConfig({ ...prod, AUTH_VERIFIER: "fake" })).toThrow(/AUTH_VERIFIER/);
  expect(() => loadConfig({ ...prod, AUTH_VERIFIER: "clerk" })).toThrow(/CLERK_SECRET_KEY/);
  expect(() =>
    loadConfig({
      ...prod,
      REVALIDATE_URL: "https://darb.co.il/api/revalidate",
      REVALIDATE_SECRET: "s",
    }),
  ).toThrow(/REVALIDATE_SECRET/);
});

it("allows the fake verifier outside production only", () => {
  expect(loadConfig({ ...base, AUTH_VERIFIER: "fake" }).auth.verifier).toBe("fake");
});

it("treats an empty env line as unset instead of refusing to start", () => {
  const config = loadConfig({
    ...base,
    REVALIDATE_URL: "",
    REVALIDATE_SECRET: "",
    WEB_ORIGIN: "",
    REDIS_URL: " ",
    PORT: "",
    INTENT_PROVIDER: "",
    EMBEDDING_PROVIDER: "",
    AUTH_VERIFIER: "",
    SEARCH_INDEX_WORKER: "",
    MODEL_CALLS_PER_DAY: "",
  });
  expect(config.admin).toEqual({ revalidateUrl: null, revalidateSecret: null });
  expect(config.webOrigin).toBe("http://localhost:3000");
  expect(config.search.redisUrl).toBe("redis://localhost:6380");
  expect(config.port).toBe(4000);
  expect(config.search.intentProvider).toBe("off");
  expect(config.search.embeddingProvider).toBe("hash");
  expect(config.auth.verifier).toBe("off");
  expect(config.search.indexWorker).toBe(true);
  expect(config.search.modelCallsPerDay).toBe(5000);
  expect(() => loadConfig({ DATABASE_URL: "" })).toThrow(/DATABASE_URL/);
  expect(() => loadConfig({ ...base, REVALIDATE_URL: "not a url" })).toThrow(/REVALIDATE_URL/);
});
