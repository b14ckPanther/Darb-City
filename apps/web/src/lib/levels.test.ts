// @vitest-environment node
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getPlace = vi.fn();
const getTaxonomy = vi.fn();
const getBusiness = vi.fn();
vi.mock("./api", () => ({ getPlace, getTaxonomy, getBusiness }));
const redirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT ${url}`);
});
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
  permanentRedirect: (url: string) => {
    throw new Error(`PERMANENT ${url}`);
  },
  redirect,
}));
const { loadBusinessLevel, loadKindLevel, loadKindLevelInSector, placeKindShortcut } =
  await import("./levels");

const kind = (id: string, slug: string, sectorId: string) => ({
  id,
  slug,
  sectorId,
  parentKindId: null,
  name: { en: slug },
  template: "booking",
  attributes: [],
  icon: null,
  order: 1,
});
const sector = (id: string, slug: string, kinds: unknown[]) => ({
  id,
  slug,
  name: { en: slug },
  tagline: { en: "t" },
  accent: "#aa7744",
  order: 1,
  kinds,
});

getPlace.mockResolvedValue({ slug: "sakhnin", name: { he: "סח'נין" } });
getTaxonomy.mockResolvedValue({
  sectors: [
    sector("s1", "beauty", [kind("k1", "barbershops", "s1")]),
    sector("s2", "food", [kind("k2", "bakeries", "s2")]),
  ],
});

afterEach(() => redirect.mockClear());

const raw = { locale: "he", place: "sakhnin", sector: "food", kind: "barbershops" };

describe("kind level loader", () => {
  it("redirects a kind under the wrong sector and keeps the business slug", async () => {
    await expect(loadKindLevel(raw, ["samers-barbershop"])).rejects.toThrow(
      "REDIRECT /sakhnin/beauty/barbershops/samers-barbershop",
    );
  });
  it("lets the layout skip a wrong-sector kind instead of redirecting", async () => {
    expect(await loadKindLevelInSector(raw)).toBeNull();
    expect(redirect).not.toHaveBeenCalled();
  });
  it("returns the level when the sector is right", async () => {
    const level = await loadKindLevelInSector({ ...raw, sector: "beauty" });
    expect(level?.kind.slug).toBe("barbershops");
    expect(level?.sector.slug).toBe("beauty");
  });
});

describe("place kind shortcut", () => {
  it("goes to the canonical kind URL of a known place", async () => {
    expect(await placeKindShortcut({ locale: "ar", place: "sakhnin", kind: "barbershops" })).toBe(
      "/ar/sakhnin/beauty/barbershops",
    );
  });
  it("sends the country to the national kind page", async () => {
    expect(await placeKindShortcut({ locale: "en", place: "israel", kind: "bakeries" })).toBe(
      "/en/k/bakeries",
    );
  });
  it("is not found for an unknown place or kind", async () => {
    getPlace.mockResolvedValueOnce(null);
    await expect(
      placeKindShortcut({ locale: "he", place: "atlantis", kind: "bakeries" }),
    ).rejects.toThrow("NOT_FOUND");
    await expect(
      placeKindShortcut({ locale: "he", place: "sakhnin", kind: "nope" }),
    ).rejects.toThrow("NOT_FOUND");
  });
});

describe("business level loader", () => {
  const at = (slug: string, ancestors: string[]) => ({
    id: slug,
    slug,
    name: { en: slug },
    ancestors: ancestors.map((a) => ({ id: a, slug: a, name: { en: a } })),
    children: [],
  });
  const places: Record<string, unknown> = {
    haifa: at("haifa", ["israel"]),
    "kiryat-haim": at("kiryat-haim", ["israel", "haifa"]),
    sakhnin: at("sakhnin", ["israel"]),
  };
  const biz = (placeSlug: string) => ({
    slug: "samers",
    placeSlug,
    name: { en: "Samer's" },
    primaryKindId: "k1",
    kindIds: ["k1"],
  });
  const kindRaw = { locale: "en", place: "haifa", sector: "beauty", kind: "barbershops" };
  beforeEach(() => {
    getPlace.mockImplementation(async (slug: string) => places[slug] ?? null);
    getBusiness.mockReset();
  });
  afterAll(() => getPlace.mockResolvedValue({ slug: "sakhnin", name: { he: "סח'נין" } }));

  it("shows a business of the listed place at its own URL", async () => {
    getBusiness.mockResolvedValue(biz("haifa"));
    const level = await loadBusinessLevel(kindRaw, { business: "samers" });
    expect(getBusiness).toHaveBeenCalledWith("haifa", "samers");
    expect(level.home.slug).toBe("haifa");
    expect(level.segments).toEqual(["haifa", "beauty", "barbershops", "samers"]);
    expect(level.canonical).toEqual(level.segments);
  });
  it("accepts a business from beneath the listed place, canonical at its own place", async () => {
    getBusiness.mockResolvedValue(biz("kiryat-haim"));
    const level = await loadBusinessLevel(kindRaw, { business: "samers" });
    expect(level.place.slug).toBe("haifa");
    expect(level.home.slug).toBe("kiryat-haim");
    // Links from the sheet (locale switch, crumb) use the exact address, which names its place.
    expect(level.segments).toEqual(["haifa", "beauty", "barbershops", "kiryat-haim", "samers"]);
    expect(level.canonical).toEqual(["kiryat-haim", "beauty", "barbershops", "samers"]);
  });
  it("opens a neighbourhood's business named by its place, even when the city has a twin", async () => {
    getBusiness.mockResolvedValue(biz("kiryat-haim"));
    const level = await loadBusinessLevel(kindRaw, { place: "kiryat-haim", business: "samers" });
    expect(getBusiness).toHaveBeenCalledWith("kiryat-haim", "samers");
    expect(level.segments).toEqual(["haifa", "beauty", "barbershops", "kiryat-haim", "samers"]);
    expect(level.canonical).toEqual(["kiryat-haim", "beauty", "barbershops", "samers"]);
  });
  it("is not found for a place outside the listed one, or the listed place itself", async () => {
    getBusiness.mockResolvedValue(biz("sakhnin"));
    await expect(
      loadBusinessLevel(kindRaw, { place: "sakhnin", business: "samers" }),
    ).rejects.toThrow("NOT_FOUND");
    getBusiness.mockResolvedValue(biz("haifa"));
    await expect(
      loadBusinessLevel(kindRaw, { place: "haifa", business: "samers" }),
    ).rejects.toThrow("NOT_FOUND");
  });
  it("is not found when the named place does not hold the business itself", async () => {
    getBusiness.mockResolvedValue(biz("deeper"));
    await expect(
      loadBusinessLevel(kindRaw, { place: "kiryat-haim", business: "samers" }),
    ).rejects.toThrow("NOT_FOUND");
  });
  it("is not found for an unknown business or another kind", async () => {
    getBusiness.mockResolvedValue(null);
    await expect(loadBusinessLevel(kindRaw, { business: "nope" })).rejects.toThrow("NOT_FOUND");
    getBusiness.mockResolvedValue({ ...biz("haifa"), primaryKindId: "k2", kindIds: ["k2"] });
    await expect(loadBusinessLevel(kindRaw, { business: "samers" })).rejects.toThrow("NOT_FOUND");
  });
});
