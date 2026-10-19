// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import robots, { dynamic } from "./robots";

let host = "darb.co.il";
vi.mock("next/headers", () => ({ headers: async () => new Headers({ host }) }));
// 2,501 businesses: two business slices per language besides its page sitemap.
vi.mock("@/lib/api", () => ({ getSitemapBusinesses: async () => Array.from({ length: 2501 }) }));

afterEach(() => {
  vi.unstubAllEnvs();
  host = "darb.co.il";
});

it("blocks everything off production", async () => {
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.stubEnv("VERCEL_URL", "x.vercel.app");
  expect((await robots()).rules).toEqual([{ userAgent: "*", disallow: "/" }]);
});

it("blocks production's *.vercel.app host", async () => {
  vi.stubEnv("VERCEL_ENV", "production");
  vi.stubEnv("SITE_URL", "https://darb.co.il");
  host = "darb-city.vercel.app";
  expect((await robots()).rules).toEqual([{ userAgent: "*", disallow: "/" }]);
});

it("opens production except admin, helpers, api and search, and lists the sitemaps", async () => {
  vi.stubEnv("VERCEL_ENV", "production");
  vi.stubEnv("SITE_URL", "https://darb.co.il");
  const r = await robots();
  expect(r.rules).toEqual([
    {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/ar/admin",
        "/en/admin",
        "/helpers",
        "/ar/helpers",
        "/en/helpers",
        "/api/",
        "/search",
        "/ar/search",
        "/en/search",
      ],
    },
  ]);
  expect(r.sitemap).toEqual(
    [0, 1, 2, 100, 101, 102, 200, 201, 202].map((i) => `https://darb.co.il/sitemap/${i}.xml`),
  );
});

it("reads the deployment at request time, not at build", () => {
  expect(dynamic).toBe("force-dynamic");
});
