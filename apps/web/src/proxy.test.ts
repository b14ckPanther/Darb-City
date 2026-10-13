// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, expect, it, vi } from "vitest";
import { proxy } from "./proxy";

afterEach(() => vi.unstubAllEnvs());

it("puts the CSP and security headers on city pages", async () => {
  const res = await proxy(new NextRequest("http://localhost:3000/sakhnin"));
  expect(res.headers.get("content-security-policy")).toContain("worker-src 'self'");
  expect(res.headers.get("x-content-type-options")).toBe("nosniff");
});

it("puts them on redirects too", async () => {
  const res = await proxy(new NextRequest("http://localhost:3000/he/sakhnin"));
  expect([307, 308]).toContain(res.status);
  expect(res.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
});

it("keeps every non-production deployment out of search engines", async () => {
  vi.stubEnv("VERCEL_ENV", "preview");
  const preview = await proxy(new NextRequest("http://localhost:3000/sakhnin"));
  expect(preview.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  vi.stubEnv("VERCEL_ENV", "production");
  const live = await proxy(new NextRequest("http://localhost:3000/sakhnin"));
  expect(live.headers.get("x-robots-tag")).toBeNull();
});
