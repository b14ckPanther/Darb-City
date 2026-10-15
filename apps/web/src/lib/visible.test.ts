import type { TaxonomyDto } from "@darb/contracts";
import { describe, expect, it } from "vitest";
import { indexTaxonomy } from "./taxonomy";
import { withBusinesses, withBusinessesTaxonomy } from "./visible";

const kind = (id: string, slug: string, sectorId: string, order: number) => ({
  id,
  slug,
  sectorId,
  parentKindId: null,
  name: { en: slug },
  template: "booking" as const,
  attributes: [],
  icon: null,
  order,
});
const sector = (id: string, slug: string, order: number, kinds: ReturnType<typeof kind>[]) => ({
  id,
  slug,
  name: { en: slug },
  tagline: { en: "t" },
  accent: "#aa7744",
  order,
  kinds,
});
const taxonomy: TaxonomyDto = {
  sectors: [
    sector("s1", "beauty", 1, [kind("k1", "barbershops", "s1", 1), kind("k2", "salons", "s1", 2)]),
    sector("s2", "food", 2, [kind("k3", "restaurants", "s2", 1)]),
  ],
};

describe("withBusinesses", () => {
  it("keeps places with at least one business and drops empty or unknown ones", () => {
    const places = [{ slug: "sakhnin" }, { slug: "tamra" }, { slug: "eilat" }];
    expect(withBusinesses(places, { sakhnin: 2, tamra: 0 })).toEqual([{ slug: "sakhnin" }]);
  });
});

describe("withBusinessesTaxonomy", () => {
  const index = indexTaxonomy(taxonomy);

  it("drops empty kinds and the sectors left with none", () => {
    const shown = withBusinessesTaxonomy(index, { barbershops: 3, salons: 0, restaurants: 0 });
    expect(shown.sectors.map((s) => s.slug)).toEqual(["beauty"]);
    expect(shown.doorsBySector.get("s1")?.map((k) => k.slug)).toEqual(["barbershops"]);
    expect(shown.doorsBySector.has("s2")).toBe(false);
  });

  it("is empty when nothing has a business", () => {
    expect(withBusinessesTaxonomy(index, {}).sectors).toEqual([]);
  });

  it("keeps the lookups, so a direct link to an empty kind still resolves", () => {
    const shown = withBusinessesTaxonomy(index, {});
    expect(shown.kindBySlug.get("salons")?.id).toBe("k2");
    expect(shown.sectorBySlug.get("food")?.id).toBe("s2");
  });
});
