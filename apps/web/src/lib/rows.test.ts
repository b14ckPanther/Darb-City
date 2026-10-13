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
  hours: { weekly: { "0": [{ open: "09:00", close: "17:00" }] }, exceptions: [] },
  dietary: [],
});

const haifa = {
  slug: "haifa",
  name: { en: "Haifa" },
  children: [{ slug: "kiryat-haim", name: { en: "Kiryat Haim", ar: "كريات حاييم" } }],
} as unknown as PlaceDetailDto;

describe("business rows", () => {
  const ctx = { locale: "ar" as const, index, names: placeNames(haifa), here: "haifa" };
  it("links under the listed place and falls back from Arabic to Hebrew", () => {
    expect(toBusinessRow(business("samers", "haifa"), ctx)).toEqual({
      key: "haifa/samers",
      name: "המספרה של סאמר",
      tagline: "Fades",
      href: "/ar/haifa/beauty/barbershops/samers",
      example: true,
      openNow: true,
      hours: { weekly: { "0": [{ open: "09:00", close: "17:00" }] }, exceptions: [] },
      placeName: null,
      lat: 32.8,
      lng: 35.3,
      distance: null,
      glutenFree: false,
    });
  });
  it("marks a fully gluten-free kitchen (Task 27b)", () => {
    const gf = { ...business("samers", "haifa"), dietary: ["gluten_free" as const] };
    expect(toBusinessRow(gf, ctx)?.glutenFree).toBe(true);
  });
  it("carries no hours for a business without any, so the browser never recomputes it", () => {
    const none = { ...business("samers", "haifa"), openNow: null };
    expect(toBusinessRow(none, ctx)?.hours).toBeNull();
  });
  it("shows the distance on a distance-sorted list, formatted by the caller", () => {
    const row = toBusinessRow(
      { ...business("samers", "haifa"), distanceKm: 1.25 },
      { ...ctx, kmLabel: (km) => `${km.toFixed(1)} km` },
    );
    expect(row?.distance).toBe("1.3 km");
    expect(
      toBusinessRow({ ...business("samers", "haifa"), distanceKm: 1.25 }, ctx)?.distance,
    ).toBeNull();
  });
  it("names the neighbourhood when a row comes from below the current place", () => {
    expect(toBusinessRow(business("samers", "kiryat-haim"), ctx)?.placeName).toBe("كريات حاييم");
  });
  it("keeps a row from a neighbourhood under the listed place, naming its own place", () => {
    // Slugs are unique per place only, so the business's place stays in the URL.
    expect(toBusinessRow(business("samers", "kiryat-haim"), ctx)?.href).toBe(
      "/ar/haifa/beauty/barbershops/kiryat-haim/samers",
    );
    expect(toBusinessRow(business("samers", "kiryat-haim"), ctx)?.key).toBe("kiryat-haim/samers");
  });
  it("links into the business's own place when the list spans the country", () => {
    expect(toBusinessRow(business("samers", "kiryat-haim"), { ...ctx, here: null })?.href).toBe(
      "/ar/kiryat-haim/beauty/barbershops/samers",
    );
  });
  it("drops rows whose kind is not in the taxonomy", () => {
    expect(
      toRows([business("a", "haifa"), business("b", "haifa", "hidden")], ctx).map((r) => r.key),
    ).toEqual(["haifa/a"]);
  });
});
