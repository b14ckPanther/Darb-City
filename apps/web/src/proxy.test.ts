// @vitest-environment node
import { NextRequest } from "next/server";
import { expect, it } from "vitest";
import { proxy } from "./proxy";

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
