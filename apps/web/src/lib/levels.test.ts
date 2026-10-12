// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

const getPlace = vi.fn();
const getTaxonomy = vi.fn();
vi.mock("./api", () => ({ getPlace, getTaxonomy }));
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
const { loadKindLevel, loadKindLevelInSector, placeKindShortcut } = await import("./levels");

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
