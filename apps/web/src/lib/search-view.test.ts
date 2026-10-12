import { EMPTY_INTENT, type SearchResponseDto } from "@darb/contracts";
import { describe, expect, it } from "vitest";
import { indexTaxonomy } from "./taxonomy";
import { chipsFor, narrowestChip, removeChip, toSearchView, type ViewContext } from "./search-view";

const index = indexTaxonomy({
  sectors: [
    {
      id: "s1",
      slug: "food",
      name: { en: "Food" },
      tagline: {},
      accent: "#d6a473",
      order: 1,
      kinds: [
        {
          id: "k1",
          slug: "sweets",
          sectorId: "s1",
          parentKindId: null,
          name: { en: "Knafeh and Arabic sweets" },
          template: "menu",
          attributes: ["delivers"],
          icon: null,
          order: 1,
        },
      ],
    },
  ],
});
const ctx: ViewContext = {
  locale: "en",
  index,
  names: new Map([
    ["akko", { en: "Akko" }],
    ["haifa", { en: "Haifa" }],
  ]),
  place: { slug: "akko", name: "Akko", lat: 32.92, lng: 35.07 },
  labels: { openNow: "Open now", delivers: "Delivers", nearMe: "Near me" },
  kmLabel: (km) => `${km.toFixed(1)} km`,
};
const intent = {
  ...EMPTY_INTENT,
  kinds: ["sweets"],
  place: "akko",
  openNow: true,
  freeText: "pistachio",
};
const item = {
  id: "b1",
  slug: "abu-salem",
  name: { en: "Abu Salem" },
  tagline: {},
  tier: "example" as const,
  primaryKindId: "k1",
  placeId: "p1",
  placeSlug: "akko",
  lat: 32.921,
  lng: 35.071,
  photo: null,
  openNow: true,
  distanceKm: 1.25,
};
const response: SearchResponseDto = {
  status: "ok",
  lane: "smart",
  queryId: "q1",
  intent,
  needsLocation: false,
  items: [item],
  nearest: [],
};

describe("search view", () => {
  it("draws chips from the intent in a fixed order", () => {
    expect(chipsFor(intent, ctx).map((c) => [c.id, c.label])).toEqual([
      ["place:akko", "Akko"],
      ["kind:sweets", "Knafeh and Arabic sweets"],
      ["openNow", "Open now"],
      ["text", "“pistachio”"],
    ]);
  });
  it("removes one chip from the intent and nothing else", () => {
    expect(removeChip(intent, "kind:sweets")).toEqual({ ...intent, kinds: [] });
    expect(removeChip(intent, "place:akko").place).toBeNull();
    expect(removeChip(intent, "openNow").openNow).toBe(false);
    expect(removeChip(intent, "text").freeText).toBe("");
    expect(removeChip(intent, "nope")).toEqual(intent);
  });
  it("suggests the narrowest chip first", () => {
    expect(narrowestChip(chipsFor(intent, ctx))?.id).toBe("text");
    expect(narrowestChip(chipsFor({ ...intent, freeText: "" }, ctx))?.id).toBe("openNow");
    expect(narrowestChip([])).toBeNull();
  });
  it("builds rows that open in their own place, with distance, and pins for the stage", () => {
    const view = toSearchView(response, "knafeh akko", ctx);
    expect(view.rows[0]).toMatchObject({
      key: "akko/abu-salem",
      href: "/en/akko/food/sweets/abu-salem",
      distance: "1.3 km",
      lat: 32.921,
      lng: 35.071,
    });
    expect(view.stage).toEqual({
      depth: 3,
      place: ctx.place,
      pins: [
        {
          key: "akko/abu-salem",
          href: "/en/akko/food/sweets/abu-salem",
          name: "Abu Salem",
          lat: 32.921,
          lng: 35.071,
        },
      ],
    });
  });
  it("shows the country when a search has nothing to pin", () => {
    expect(toSearchView({ ...response, items: [] }, "x", { ...ctx, place: null }).stage).toEqual({
      depth: 0,
    });
  });
});
