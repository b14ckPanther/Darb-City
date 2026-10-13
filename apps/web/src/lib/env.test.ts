// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { assertServerEnv } from "./env";

afterEach(() => vi.restoreAllMocks());

const long = "x".repeat(32);
const prod = {
  NODE_ENV: "production",
  SITE_URL: "https://darb.co.il",
  API_URL: "https://api.darb.co.il",
  SEARCH_PROXY_KEY: long,
  REVALIDATE_SECRET: long,
};

it("accepts a complete production environment", () => {
  expect(() => assertServerEnv(prod)).not.toThrow();
});

it("names every weak or missing production secret", () => {
  expect(() => assertServerEnv({ ...prod, SEARCH_PROXY_KEY: "dev-proxy-key" })).toThrow(
    /SEARCH_PROXY_KEY/,
  );
  expect(() => assertServerEnv({ ...prod, REVALIDATE_SECRET: "change-me" })).toThrow(
    /REVALIDATE_SECRET/,
  );
  expect(() => assertServerEnv({ ...prod, API_URL: undefined })).toThrow(/API_URL/);
});

it("lets local production runs (e2e) use short development keys", () => {
  expect(() =>
    assertServerEnv({
      ...prod,
      SITE_URL: "http://localhost:3100",
      SEARCH_PROXY_KEY: "e2e-proxy-key",
      REVALIDATE_SECRET: "e2e",
    }),
  ).not.toThrow();
  expect(() => assertServerEnv({ NODE_ENV: "development" })).not.toThrow();
});

it("refuses any production server without a proxy key, even a local one", () => {
  // Without it every visitor shares one API suggest bucket and suggestions silently go empty.
  expect(() =>
    assertServerEnv({ ...prod, SITE_URL: "http://localhost:3100", SEARCH_PROXY_KEY: undefined }),
  ).toThrow(/SEARCH_PROXY_KEY/);
  expect(() => assertServerEnv({ ...prod, SEARCH_PROXY_KEY: "" })).toThrow(/SEARCH_PROXY_KEY/);
});

it("only warns in development when the proxy key is missing", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  expect(() => assertServerEnv({ NODE_ENV: "development" })).not.toThrow();
  expect(warn).toHaveBeenCalledWith(expect.stringMatching(/SEARCH_PROXY_KEY/));
  warn.mockClear();
  assertServerEnv({ NODE_ENV: "development", SEARCH_PROXY_KEY: "dev-proxy-key" });
  expect(warn).not.toHaveBeenCalled();
});
