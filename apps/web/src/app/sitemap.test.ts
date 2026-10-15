// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({
  getPlaceCounts: async () => ({ sakhnin: 1, tamra: 0 }),
  getKindCounts: async (place: string) =>
    place === "tamra" ? { restaurants: 0, empty: 0 } : { restaurants: 1, empty: 0 },
  getPlaces: async () => [
    {
      id: "p",
      slug: "sakhnin",
      type: "city",
      name: { en: "Sakhnin" },
      status: "live",
      lat: 0,
      lng: 0,
      parentId: null,
    },
    {
      id: "p2",
      slug: "tamra",
      type: "city",
      name: { en: "Tamra" },
      status: "live",
      lat: 0,
      lng: 0,
      parentId: null,
    },
  ],
  getTaxonomy: async () => ({
    sectors: [
      {
        id: "s",
        slug: "food",
        name: { en: "Food" },
        tagline: { en: "" },
        accent: "#000000",
        order: 1,
        kinds: [
          {
            id: "k",
            slug: "restaurants",
            sectorId: "s",
            parentKindId: null,
            name: { en: "Restaurants" },
            template: "menu",
            attributes: [],
            icon: null,
            order: 1,
          },
        ],
      },
      {
        id: "s2",
        slug: "beauty",
        name: { en: "Beauty" },
        tagline: { en: "" },
        accent: "#000000",
        order: 2,
        kinds: [
          {
            id: "k2",
            slug: "empty",
            sectorId: "s2",
            parentKindId: null,
            name: { en: "Empty" },
            template: "booking",
            attributes: [],
            icon: null,
            order: 1,
          },
        ],
      },
    ],
  }),
  getSitemapBusinesses: async () => [
    {
      placeSlug: "sakhnin",
      slug: "caramel",
      primaryKindId: "k",
      updatedAt: "2026-10-13T00:00:00.000Z",
    },
    { placeSlug: "sakhnin", slug: "orphan", primaryKindId: "gone", updatedAt: "2026-10-13" },
  ],
}));
const mod = await import("./sitemap");
const { default: sitemap, generateSitemaps } = mod;
afterEach(() => vi.unstubAllEnvs());

it("has one sitemap per locale with places, sectors, kinds and real businesses", async () => {
  vi.stubEnv("SITE_URL", "https://darb.co.il");
  expect(await generateSitemaps()).toEqual([{ id: 0 }, { id: 1 }, { id: 2 }]);
  const en = await sitemap({ id: Promise.resolve("2") });
  const urls = en.map((e) => e.url);
  expect(urls).toEqual([
    "https://darb.co.il/en",
    "https://darb.co.il/en/sakhnin",
    "https://darb.co.il/en/sakhnin/food",
    "https://darb.co.il/en/k/restaurants",
    "https://darb.co.il/en/sakhnin/food/restaurants/caramel",
  ]);
  expect(en[1]?.alternates?.languages).toMatchObject({ he: "https://darb.co.il/sakhnin" });
  expect(en[4]?.lastModified).toBe("2026-10-13T00:00:00.000Z");
});

it("leaves out places, sectors and kinds that have no published business", async () => {
  vi.stubEnv("SITE_URL", "https://darb.co.il");
  const urls = (await sitemap({ id: Promise.resolve("2") })).map((e) => e.url);
  expect(urls.some((u) => u.includes("tamra"))).toBe(false);
  expect(urls.some((u) => u.includes("beauty") || u.includes("empty"))).toBe(false);
});

it("gives the Hebrew home the bare origin", async () => {
  vi.stubEnv("SITE_URL", "https://darb.co.il");
  const he = await sitemap({ id: Promise.resolve("0") });
  expect(he[0]?.url).toBe("https://darb.co.il/");
  expect(he[1]?.url).toBe("https://darb.co.il/sakhnin");
});

it("renders on request, so the build never needs the API (its fetches stay cached a day)", () => {
  expect(mod.dynamic).toBe("force-dynamic");
});
