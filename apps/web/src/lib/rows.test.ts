import type { BusinessSummaryDto, PlaceDetailDto, TaxonomyDto } from "@darb/contracts";
import { describe, expect, it } from "vitest";
import { placeNames, toBusinessRow, toRows } from "./rows";
import { indexTaxonomy } from "./taxonomy";

const index = indexTaxonomy({
  sectors: [
    {
      id: "s1",
      slug: "beauty",
      name: { en: "Beauty" },
      tagline: { en: "t" },
      accent: "#aa7744",
      order: 1,
      kinds: [
        {
          id: "k1",
          slug: "barbershops",
          sectorId: "s1",
          parentKindId: null,
          name: { en: "Barbers" },
          template: "booking",
          attributes: [],
          icon: null,
          order: 1,
        },
      ],
    },
  ],
} satisfies TaxonomyDto);

const business = (slug: string, placeSlug: string, primaryKindId = "k1"): BusinessSummaryDto => ({
  id: slug,
  slug,
  name: { he: "המספרה של סאמר", en: "Samer's" },
  tagline: { en: "Fades" },
  tier: "example",
  primaryKindId,
  placeId: placeSlug,
  placeSlug,
  lat: 32.8,
  lng: 35.3,
  photo: null,
  openNow: true,
});

const haifa = {
  slug: "haifa",
  name: { en: "Haifa" },
  children: [{ slug: "kiryat-haim", name: { en: "Kiryat Haim", ar: "كريات حاييم" } }],
} as unknown as PlaceDetailDto;

describe("business rows", () => {
  const ctx = { locale: "ar" as const, index, names: placeNames(haifa), here: "haifa" };
  it("links into the business's own place and falls back from Arabic to Hebrew", () => {
    expect(toBusinessRow(business("samers", "haifa"), ctx)).toEqual({
      key: "haifa/samers",
      name: "המספרה של סאמר",
      tagline: "Fades",
      href: "/ar/haifa/beauty/barbershops/samers",
      example: true,
      openNow: true,
      placeName: null,
    });
  });
  it("names the neighbourhood when a row comes from below the current place", () => {
    expect(toBusinessRow(business("samers", "kiryat-haim"), ctx)?.placeName).toBe("كريات حاييم");
    expect(toBusinessRow(business("samers", "kiryat-haim"), ctx)?.href).toBe(
      "/ar/kiryat-haim/beauty/barbershops/samers",
    );
  });
  it("drops rows whose kind is not in the taxonomy", () => {
    expect(
      toRows([business("a", "haifa"), business("b", "haifa", "hidden")], ctx).map((r) => r.key),
    ).toEqual(["haifa/a"]);
  });
});
