import type { BusinessSummaryDto, PlaceDetailDto, TaxonomyDto } from "@darb/contracts";
import { describe, expect, it } from "vitest";
import { placeNames } from "./rows";
import { cameraFor } from "@darb/stage";
import {
  COUNTRY_STAGE,
  kindStage,
  placeStage,
  searchStage,
  sectorStage,
  soonStage,
} from "./stage-data";
import { indexTaxonomy } from "./taxonomy";

const kind = (id: string, slug: string, parentKindId: string | null = null, order = 1) => ({
  id,
  slug,
  sectorId: "s1",
  parentKindId,
  name: { he: slug, en: slug.toUpperCase() },
  template: "booking" as const,
  attributes: [],
  icon: null,
  order,
});
const index = indexTaxonomy({
  sectors: [
    {
      id: "s1",
      slug: "beauty",
      name: { he: "יופי", en: "Beauty" },
      tagline: { en: "t" },
      accent: "#d9aaa2",
      order: 1,
      kinds: [kind("k1", "barbershops"), kind("k2", "nails", null, 2), kind("k3", "kids", "k1")],
    },
  ],
} satisfies TaxonomyDto);
const haifa = {
  slug: "haifa",
  name: { he: "חיפה", en: "Haifa" },
  lat: 32.79,
  lng: 34.99,
  children: [{ slug: "kiryat-haim", name: { en: "Kiryat Haim" } }],
} as unknown as PlaceDetailDto;
const business = (slug: string, placeSlug: string): BusinessSummaryDto => ({
  id: slug,
  slug,
  name: { en: slug },
  tagline: { en: "" },
  tier: "example",
  primaryKindId: "k1",
  placeId: placeSlug,
  placeSlug,
  lat: 32.8,
  lng: 35.01,
  photo: null,
  openNow: null,
  hours: { weekly: {}, exceptions: [] },
});

describe("stage levels", () => {
  it("is the country map at level 0", () => {
    expect(COUNTRY_STAGE).toEqual({ depth: 0 });
  });
  it("gives a place one door per sector, with the list door's href and total", () => {
    expect(placeStage("en", haifa, index, new Map([["beauty", 12]]))).toEqual({
      depth: 1,
      place: { slug: "haifa", name: "Haifa", lat: 32.79, lng: 34.99 },
      doors: [
        { slug: "beauty", href: "/en/haifa/beauty", label: "Beauty", count: 12, accent: "#d9aaa2" },
      ],
    });
  });
  it("gives a sector one door per top-level kind, zero counts included", () => {
    const level = sectorStage("he", haifa, index.sectorBySlug.get("beauty")!, index, {
      barbershops: 3,
    });
    expect(level).toMatchObject({
      depth: 2,
      sector: { slug: "beauty", name: "יופי", accent: "#d9aaa2" },
    });
    expect(level.depth === 2 && level.doors).toEqual([
      {
        slug: "barbershops",
        href: "/haifa/beauty/barbershops",
        label: "barbershops",
        count: 3,
        accent: "#d9aaa2",
      },
      { slug: "nails", href: "/haifa/beauty/nails", label: "nails", count: 0, accent: "#d9aaa2" },
    ]);
  });
  it("pins each listed business at its row's href, sub-place businesses under the listed place", () => {
    const ctx = { locale: "en" as const, index, names: placeNames(haifa), here: "haifa" };
    const level = kindStage(
      "en",
      haifa,
      [business("a", "haifa"), business("b", "kiryat-haim")],
      ctx,
    );
    expect(level.depth === 3 && level.pins).toEqual([
      { key: "haifa/a", href: "/en/haifa/beauty/barbershops/a", name: "a", lat: 32.8, lng: 35.01 },
      {
        key: "kiryat-haim/b",
        href: "/en/haifa/beauty/barbershops/kiryat-haim/b",
        name: "b",
        lat: 32.8,
        lng: 35.01,
      },
    ]);
  });
  it("shows a soon place as the map at that place", () => {
    expect(soonStage("en", haifa)).toEqual({
      depth: 3,
      place: { slug: "haifa", name: "Haifa", lat: 32.79, lng: 34.99 },
      pins: [],
    });
  });
});

describe("search on the map", () => {
  const row = (key: string, lat: number, lng: number) => ({
    key,
    name: key,
    tagline: "",
    href: `/${key}`,
    example: false,
    openNow: null,
    hours: null,
    placeName: key.split("/")[0]!,
    lat,
    lng,
    distance: null,
  });
  it("frames every result of a nationwide search, not the first result's city", () => {
    const stage = searchStage(null, [row("haifa/a", 32.8, 35.0), row("eilat/b", 29.55, 34.95)]);
    expect(stage.depth).toBe(3);
    if (stage.depth !== 3) return;
    expect(stage.place.slug).toBe("");
    expect(stage.place.lat).toBeCloseTo((32.8 + 29.55) / 2);
    expect(cameraFor(stage)).toEqual({
      bounds: [
        [34.93, 29.53],
        [35.02, 32.82],
      ],
      maxZoom: 15,
    });
  });
  it("keeps the searched place when there is one", () => {
    const place = { slug: "akko", name: "Akko", lat: 32.92, lng: 35.07 };
    const stage = searchStage(place, [row("akko/a", 32.92, 35.07)]);
    expect(stage).toMatchObject({ depth: 3, place });
  });
});
