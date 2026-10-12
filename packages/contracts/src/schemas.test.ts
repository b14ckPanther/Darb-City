import { describe, expect, it } from "vitest";
import { contract } from "./contract.js";
import {
  BusinessDetailSchema,
  BusinessPageSchema,
  HoursSchema,
  LocalizedSchema,
  PlaceSchema,
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
