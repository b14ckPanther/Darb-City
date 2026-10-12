import { describe, expect, it } from "vitest";
import { contract } from "./contract.js";
import {
  BusinessDetailSchema,
  BusinessPageSchema,
  DensitySchema,
  HoursSchema,
  LocalizedSchema,
  PlaceSchema,
  ScreenSchema,
} from "./schemas.js";

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

describe("businesses.list query", () => {
  const query = contract.businesses.list.query;
  it("defaults limit to 30 and accepts 1 to 100", () => {
    expect(query.parse({}).limit).toBe(30);
    expect(query.parse({ limit: "1" }).limit).toBe(1);
    expect(query.parse({ limit: "100" }).limit).toBe(100);
  });
  it("rejects limits outside 1 to 100 and empty cursors", () => {
    expect(query.safeParse({ limit: "0" }).success).toBe(false);
    expect(query.safeParse({ limit: "101" }).success).toBe(false);
    expect(query.safeParse({ cursor: "" }).success).toBe(false);
  });
});

describe("BusinessPageSchema", () => {
  it("carries items and a nullable cursor", () => {
    expect(BusinessPageSchema.parse({ items: [], nextCursor: null })).toEqual({
      items: [],
      nextCursor: null,
    });
  });
});

describe("coordinates", () => {
  const query = contract.places.nearest.query;
  it("accept numbers and numeric strings", () => {
    expect(query.parse({ lat: "32.85", lng: 35.2 })).toEqual({ lat: 32.85, lng: 35.2 });
  });
  it("reject blank, non-numeric and out-of-range values", () => {
    expect(query.safeParse({ lat: "", lng: "35" }).success).toBe(false);
    expect(query.safeParse({ lat: "  ", lng: "35" }).success).toBe(false);
    expect(query.safeParse({ lat: "abc", lng: "35" }).success).toBe(false);
    expect(query.safeParse({ lat: "91", lng: "35" }).success).toBe(false);
  });
});

describe("ScreenSchema", () => {
  const screen = {
    brand: { he: "המספרה של סאמר", en: "Samer's" },
    title: { en: "A chair in two taps" },
    items: [{ label: { en: "Haircut" }, meta: { en: "₪60" } }],
    cta: { en: "Book" },
    palette: { bg: "#efe3cf", surface: "#fbf5ea", ink: "#2b1d14", accent: "#b4542a" },
    font: "Suez One",
  };
  it("accepts a showroom screen", () => {
    expect(ScreenSchema.parse(screen).font).toBe("Suez One");
  });
  it("rejects a screen without items or with a bad colour", () => {
    expect(ScreenSchema.safeParse({ ...screen, items: [] }).success).toBe(false);
    expect(
      ScreenSchema.safeParse({ ...screen, palette: { ...screen.palette, bg: "red" } }).success,
    ).toBe(false);
  });
});

describe("DensitySchema", () => {
  it("maps place slugs to non-negative whole counts", () => {
    expect(DensitySchema.parse({ sakhnin: 2, tamra: 0 })).toEqual({ sakhnin: 2, tamra: 0 });
    expect(() => DensitySchema.parse({ sakhnin: -1 })).toThrow();
    expect(() => DensitySchema.parse({ sakhnin: 1.5 })).toThrow();
  });
  it("is served at GET /density", () => {
    expect(contract.businesses.density.path).toBe("/density");
    expect(contract.businesses.density.method).toBe("GET");
  });
});
