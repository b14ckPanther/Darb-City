import type { TaxonomyDto } from "@darb/contracts";
import { describe, expect, it } from "vitest";
import { indexTaxonomy, kindCovers, sectorTotals } from "./taxonomy";

const kind = (
  id: string,
  slug: string,
  sectorId: string,
  order: number,
  parentKindId: string | null = null,
) => ({
  id,
  slug,
  sectorId,
  parentKindId,
  name: { en: slug },
  template: "booking" as const,
  attributes: [],
  icon: null,
  order,
});
const taxonomy: TaxonomyDto = {
  sectors: [
    {
      id: "s2",
      slug: "food",
      name: { en: "Food" },
      tagline: { en: "t" },
      accent: "#aa7744",
      order: 2,
      kinds: [kind("k3", "bakeries", "s2", 1)],
    },
    {
      id: "s1",
      slug: "beauty",
      name: { en: "Beauty" },
      tagline: { en: "t" },
      accent: "#aa7744",
      order: 1,
      kinds: [
        kind("k2", "salons", "s1", 2),
        kind("k1", "barbershops", "s1", 1),
        kind("k4", "kids-cuts", "s1", 3, "k1"),
      ],
    },
  ],
};

describe("indexTaxonomy", () => {
  const index = indexTaxonomy(taxonomy);
  it("orders sectors and their top-level doors", () => {
    expect(index.sectors.map((s) => s.slug)).toEqual(["beauty", "food"]);
    expect(index.doorsBySector.get("s1")!.map((k) => k.slug)).toEqual(["barbershops", "salons"]);
  });
  it("looks kinds and sectors up by slug and id", () => {
    expect(index.kindBySlug.get("kids-cuts")?.id).toBe("k4");
    expect(index.sectorById.get("s2")?.slug).toBe("food");
  });
  it("knows which kinds a kind covers", () => {
    expect(kindCovers(index, "k1", "k4")).toBe(true);
    expect(kindCovers(index, "k1", "k1")).toBe(true);
    expect(kindCovers(index, "k4", "k1")).toBe(false);
    expect(kindCovers(index, "k1", "unknown")).toBe(false);
  });
  it("sums door counts per sector without double counting sub-kinds", () => {
    const totals = sectorTotals(index, { barbershops: 3, "kids-cuts": 1, salons: 2 });
    expect(totals.get("beauty")).toBe(5);
    expect(totals.get("food")).toBe(0);
  });
});
