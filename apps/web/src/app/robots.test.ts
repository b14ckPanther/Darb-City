// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import robots from "./robots";

afterEach(() => vi.unstubAllEnvs());

it("blocks everything off production", () => {
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.stubEnv("VERCEL_URL", "x.vercel.app");
  expect(robots().rules).toEqual([{ userAgent: "*", disallow: "/" }]);
});

it("opens production except admin, api and search, and lists the sitemaps", () => {
  vi.stubEnv("VERCEL_ENV", "production");
  vi.stubEnv("SITE_URL", "https://darb.co.il");
  const r = robots();
  expect(r.rules).toEqual([
    {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/ar/admin",
        "/en/admin",
        "/api/",
        "/search",
        "/ar/search",
        "/en/search",
      ],
    },
  ]);
  expect(r.sitemap).toEqual([0, 1, 2].map((i) => `https://darb.co.il/sitemap/${i}.xml`));
});
