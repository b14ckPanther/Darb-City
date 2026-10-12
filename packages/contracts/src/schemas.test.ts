import { describe, expect, it } from "vitest";
import { BusinessDetailSchema, HoursSchema, LocalizedSchema, PlaceSchema } from "./schemas.js";

describe("LocalizedSchema", () => {
  it("accepts any one language", () => {
    expect(LocalizedSchema.parse({ ar: "حيفا" })).toEqual({ ar: "حيفا" });
  });
  it("rejects an object with no text", () => {
    expect(LocalizedSchema.safeParse({}).success).toBe(false);
    expect(LocalizedSchema.safeParse({ he: " " }).success).toBe(false);
  });
});

describe("HoursSchema", () => {
  it("accepts 24:00 and rejects malformed times", () => {
    const ok = { weekly: { "6": [{ open: "18:00", close: "24:00" }] }, exceptions: [] };
    expect(HoursSchema.safeParse(ok).success).toBe(true);
    const bad = { weekly: { "1": [{ open: "9:00", close: "17:00" }] }, exceptions: [] };
    expect(HoursSchema.safeParse(bad).success).toBe(false);
  });
});

describe("PlaceSchema", () => {
  it("rejects a non-slug", () => {
    const place = {
      id: "x",
      slug: "Haifa",
      type: "city",
      name: { en: "Haifa" },
      status: "live",
      lat: 32.8,
      lng: 35,
      parentId: null,
    };
    expect(PlaceSchema.safeParse(place).success).toBe(false);
  });
});

describe("BusinessDetailSchema", () => {
  it("parses a complete business", () => {
    const business = {
      id: "b1",
      slug: "abu-salim",
      name: { ar: "أبو سليم" },
      tagline: { en: "Fades" },
      tier: "example",
      primaryKindId: "k1",
      kindIds: ["k1"],
      placeId: "p1",
      placeSlug: "sakhnin",
      lat: 32.86,
      lng: 35.3,
      photo: null,
      openNow: true,
      address: { he: "הרחוב הראשי" },
      phone: null,
      whatsapp: null,
      website: null,
      photos: [],
      hours: { weekly: {}, exceptions: [] },
      attributes: { delivers: false },
      experience: { title: { en: "Book" } },
      apps: {},
      brandId: null,
    };
    expect(BusinessDetailSchema.parse(business).slug).toBe("abu-salim");
  });
});
