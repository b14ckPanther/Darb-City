// @vitest-environment node
import path from "node:path";
import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

it("wires the API-down cache handler when self-hosting", async () => {
  vi.stubEnv("VERCEL", "");
  const { default: config } = await import("../../next.config");
  expect(config.cacheHandler).toBe(path.resolve(process.cwd(), "cache-handler.mjs"));
});

it("leaves Vercel's platform cache alone on Vercel", async () => {
  vi.stubEnv("VERCEL", "1");
  const { default: config } = await import("../../next.config");
  expect(config).not.toHaveProperty("cacheHandler");
});
