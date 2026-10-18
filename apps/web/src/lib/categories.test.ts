import type { TaxonomyDto } from "@darb/contracts";
import { describe, expect, it } from "vitest";
import { byCount, kindRows, sectorGroups } from "./categories";
import { indexTaxonomy } from "./taxonomy";

const kind = (
  id: string,
  slug: string,
  sectorId: string,
  he: string,
  parentKindId: string | null = null,
) => ({
  id,
  slug,
  sectorId,
  parentKindId,
  name: { he, en: slug },
  template: "booking" as const,
  attributes: [],
  icon: null,
  order: 1,
});
const sector = (
  id: string,
  slug: string,
  he: string,
  order: number,
  kinds: ReturnType<typeof kind>[],
) => ({
  id,
  slug,
  name: { he, en: slug },
  tagline: { he: `${he}: שורה`, en: `${slug} line` },
  accent: "#d9aaa2",
  order,
  kinds,
});
const index = indexTaxonomy({
  sectors: [
    sector("s1", "beauty", "יופי", 1, [
      kind("k1", "barbershops", "s1", "מספרות"),
      kind("k2", "nails", "s1", "ציפורניים"),
      kind("k3", "brows", "s1", "גבות"),
      kind("k4", "kids-cuts", "s1", "תספורת ילדים", "k1"),
    ]),
    sector("s2", "auto", "רכב", 2, [
      kind("k5", "garages", "s2", "מוסכים"),
      kind("k6", "tyres", "s2", "צמיגים"),
    ]),
    sector("s3", "faith", "דת", 3, [kind("k7", "synagogues", "s3", "בתי כנסת")]),
  ],
} satisfies TaxonomyDto);

describe("category rows", () => {
  it("sorts by count, then by name in the page language", () => {
    const rows = [
      { name: "צמיגים", count: 3 },
      { name: "מוסכים", count: 140 },
      { name: "אופנועים", count: 3 },
    ].sort(byCount("he"));
    expect(rows.map((r) => r.name)).toEqual(["מוסכים", "אופנועים", "צמיגים"]);
    // English ignores case the way a person reads it.
    expect(
      [
        { name: "b", count: 1 },
        { name: "A", count: 1 },
      ]
        .sort(byCount("en"))
        .map((r) => r.name),
    ).toEqual(["A", "b"]);
  });

  it("lists a sector's top-level kinds busiest first, without the empty ones", () => {
    expect(
      kindRows("he", index.doorsBySector.get("s1")!, { barbershops: 4, nails: 9, brows: 0 }),
    ).toEqual([
      { slug: "nails", name: "ציפורניים", count: 9 },
      { slug: "barbershops", name: "מספרות", count: 4 },
    ]);
  });

  it("groups by sector, busiest sector first, and drops sectors with nothing here", () => {
    const groups = sectorGroups("he", index, { barbershops: 4, nails: 9, garages: 140, tyres: 3 });
    expect(groups.map((g) => [g.sector.slug, g.total])).toEqual([
      ["auto", 143],
      ["beauty", 13],
    ]);
    expect(groups[0]).toMatchObject({ name: "רכב", tagline: "רכב: שורה" });
    expect(groups[0]!.kinds.map((k) => k.slug)).toEqual(["garages", "tyres"]);
  });

  it("breaks a tie between sectors by name", () => {
    const groups = sectorGroups("en", index, { garages: 5, nails: 5 });
    expect(groups.map((g) => g.sector.slug)).toEqual(["auto", "beauty"]);
  });
});
