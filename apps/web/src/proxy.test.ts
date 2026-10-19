// @vitest-environment node
import { NextFetchEvent } from "next/dist/server/web/spec-extension/fetch-event";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { afterEach, expect, it, vi } from "vitest";
import { config, proxy } from "./proxy";

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
  vi.stubEnv("SITE_URL", "https://darb.co.il");
  const live = await proxy(new NextRequest("https://darb.co.il/sakhnin"));
  expect(live.headers.get("x-robots-tag")).toBeNull();
  // Production also answers on its *.vercel.app host, which stays out of search engines.
  const alias = await proxy(new NextRequest("https://darb-city.vercel.app/sakhnin"));
  expect(alias.headers.get("x-robots-tag")).toBe("noindex, nofollow");
});
it("rewrites admin URLs with a nonce CSP, noindex and no-store", async () => {
  const req = new NextRequest("http://localhost:3000/ar/admin/places");
  const res = await proxy(req, new NextFetchEvent({ request: req, page: "/", context: undefined }));
  expect(res.headers.get("x-middleware-rewrite")).toBe("http://localhost:3000/admin/ar/places");
  expect(res.headers.get("content-security-policy")).toMatch(
    /'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/,
  );
  expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  expect(res.headers.get("cache-control")).toBe("no-store");
});

const admin = (url: string) => {
  const req = new NextRequest(url);
  return proxy(req, new NextFetchEvent({ request: req, page: "/", context: undefined }));
};

it("runs on every admin path, dotted ones too, but still skips public files", () => {
  const runs = (path: string) =>
    unstable_doesMiddlewareMatch({ config, url: `http://localhost:3000${path}` });
  for (const path of [
    "/admin",
    "/admin/businesses/x.y",
    "/en/admin/businesses/x.y",
    "/ar/admin/places/a.b.c",
    "/admin/en/businesses/x.y",
  ])
    expect(runs(path), path).toBe(true);
  for (const path of ["/brand/logo.svg", "/sakhnin/x.y", "/robots.txt", "/api/revalidate"])
    expect(runs(path), path).toBe(false);
});

it("gives a dotted admin path the nonce CSP and noindex", async () => {
  const res = await admin("http://localhost:3000/en/admin/businesses/x.y");
  expect(res.headers.get("x-middleware-rewrite")).toBe(
    "http://localhost:3000/admin/en/businesses/x.y",
  );
  expect(res.headers.get("content-security-policy")).toMatch(/'nonce-[^']+' 'strict-dynamic'/);
  expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
});

it("404s the internal /admin/<locale> shape asked for directly", async () => {
  for (const path of ["/admin/en", "/admin/he/places", "/admin/ar/businesses/x.y"]) {
    const res = await admin(`http://localhost:3000${path}`);
    expect(res.status, path).toBe(404);
    expect(res.headers.get("x-middleware-rewrite"), path).toBeNull();
    expect(res.headers.get("x-robots-tag"), path).toBe("noindex, nofollow");
    expect(res.headers.get("cache-control"), path).toBe("no-store");
  }
  // Admin sections that merely start with a locale's letters are still admin pages.
  expect((await admin("http://localhost:3000/admin/enquiries")).status).not.toBe(404);
});

it("gives the helper app the admin's treatment: rewrite, nonce CSP, noindex, no-store", async () => {
  const res = await admin("http://localhost:3000/ar/helpers/mine");
  expect(res.headers.get("x-middleware-rewrite")).toBe("http://localhost:3000/helpers/ar/mine");
  expect(res.headers.get("content-security-policy")).toMatch(/'nonce-[^']+' 'strict-dynamic'/);
  expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  expect(res.headers.get("cache-control")).toBe("no-store");
  const he = await admin("http://localhost:3000/helpers");
  expect(he.headers.get("x-middleware-rewrite")).toBe("http://localhost:3000/helpers/he");
  for (const path of ["/helpers/en", "/helpers/he/mine"])
    expect((await admin(`http://localhost:3000${path}`)).status, path).toBe(404);
  const runs = (path: string) =>
    unstable_doesMiddlewareMatch({ config, url: `http://localhost:3000${path}` });
  expect(runs("/helpers/x.y")).toBe(true);
  expect(runs("/en/helpers")).toBe(true);
  expect(runs("/api/helpers/manifest/he")).toBe(false);
});

it("lets the installed admin read its own manifest: a same-origin route the proxy skips", async () => {
  const runs = (path: string) =>
    unstable_doesMiddlewareMatch({ config, url: `http://localhost:3000${path}` });
  for (const locale of ["he", "ar", "en"])
    expect(runs(`/api/admin/manifest/${locale}`), locale).toBe(false);
  const res = await admin("http://localhost:3000/en/admin");
  expect(res.headers.get("content-security-policy")).toMatch(/manifest-src 'self'/);
  expect(res.headers.get("cache-control")).toBe("no-store");
});
