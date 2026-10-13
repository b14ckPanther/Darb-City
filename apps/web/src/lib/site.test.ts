// @vitest-environment node
import { expect, it } from "vitest";
import { indexable, isLocalSite, siteUrl } from "./site";

it("prefers SITE_URL, then the Vercel preview URL, then localhost in development", () => {
  expect(siteUrl({ SITE_URL: "https://darb.co.il/", NODE_ENV: "production" })).toBe(
    "https://darb.co.il",
  );
  expect(
    siteUrl({
      VERCEL_ENV: "preview",
      VERCEL_URL: "darb-city-git-x.vercel.app",
      NODE_ENV: "production",
    }),
  ).toBe("https://darb-city-git-x.vercel.app");
  expect(siteUrl({ NODE_ENV: "development" })).toBe("http://localhost:3000");
});

it("throws in production without an origin", () => {
  expect(() => siteUrl({ NODE_ENV: "production" })).toThrow(/SITE_URL/);
});

it("knows local sites and indexable deployments", () => {
  expect(isLocalSite({ SITE_URL: "http://localhost:3100" })).toBe(true);
  expect(isLocalSite({ SITE_URL: "https://darb.co.il" })).toBe(false);
  expect(indexable({ VERCEL_ENV: "production" })).toBe(true);
  expect(indexable({ VERCEL_ENV: "preview", SITE_INDEXABLE: "1" })).toBe(false);
  expect(indexable({ SITE_INDEXABLE: "1" })).toBe(true);
  expect(indexable({})).toBe(false);
});
