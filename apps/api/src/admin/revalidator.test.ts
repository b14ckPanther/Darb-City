import { expect, it, vi } from "vitest";
import { loadConfig } from "../config.js";
import { WebRevalidator } from "./revalidator.js";

const config = loadConfig({
  DATABASE_URL: "postgresql://a/b",
  REVALIDATE_URL: "http://web.test/api/revalidate",
  REVALIDATE_SECRET: "s".repeat(32),
});

it("posts unique tags and the immediate flag with the secret", async () => {
  const r = new WebRevalidator(config);
  const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));
  r.fetchImpl = fetchImpl as unknown as typeof fetch;
  expect(await r.revalidate(["businesses", "businesses", "place:haifa"], { immediate: true })).toBe(
    true,
  );
  const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe("http://web.test/api/revalidate");
  expect((init.headers as Record<string, string>)["x-revalidate-secret"]).toBe("s".repeat(32));
  expect(JSON.parse(String(init.body))).toEqual({
    tags: ["businesses", "place:haifa"],
    immediate: true,
  });
});

it("retries once and never rejects", async () => {
  const r = new WebRevalidator(config);
  const fetchImpl = vi.fn(async () => {
    throw new Error("down");
  });
  r.fetchImpl = fetchImpl as unknown as typeof fetch;
  r.retryDelayMs = 0;
  expect(await r.revalidate(["taxonomy"])).toBe(false);
  expect(fetchImpl).toHaveBeenCalledTimes(2);
});

it("is a no-op without a URL", async () => {
  const r = new WebRevalidator(loadConfig({ DATABASE_URL: "postgresql://a/b" }));
  expect(await r.revalidate(["taxonomy"])).toBe(false);
});

it("is enabled only with both a URL and a secret", () => {
  expect(new WebRevalidator(config).enabled).toBe(true);
  expect(new WebRevalidator(loadConfig({ DATABASE_URL: "postgresql://a/b" })).enabled).toBe(false);
});
