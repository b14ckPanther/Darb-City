import { describe, expect, it } from "vitest";
import { contract } from "./contract.js";
import { LinksInputSchema, LinksSchema } from "./schemas.js";
import {
  BusinessDetailSchema,
  BusinessPageSchema,
  BusinessSummarySchema,
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
  const body = contract.places.nearest.body;
  it("accept JSON numbers in range", () => {
    expect(body.parse({ lat: 32.85, lng: 35.2 })).toEqual({ lat: 32.85, lng: 35.2 });
  });
  it("reject strings, missing and out-of-range values", () => {
    expect(body.safeParse({ lat: "", lng: 35 }).success).toBe(false);
    expect(body.safeParse({ lat: "32.8", lng: 35 }).success).toBe(false);
    expect(body.safeParse({ lng: 35 }).success).toBe(false);
    expect(body.safeParse({ lat: 91, lng: 35 }).success).toBe(false);
  });
});

/** Every route of a ts-rest router, flattened. */
const routes = (router: object): { method: string; path: string; query?: unknown }[] =>
  Object.values(router).flatMap((r: { method?: string }) =>
    typeof r.method === "string" ? [r as never] : routes(r),
  );

describe("visitor coordinates never travel in a URL (spec §5.4)", () => {
  it("no route takes lat, lng or near in its query string", () => {
    const all = routes(contract);
    expect(all.length).toBeGreaterThan(10);
    for (const route of all) {
      // A refined object (ZodEffects) keeps its shape one level down.
      type Q = { shape?: Record<string, unknown>; _def?: { schema?: Q } } | undefined;
      const query = route.query as Q;
      const shape = query?.shape ?? query?._def?.schema?.shape ?? {};
      for (const key of ["lat", "lng", "near"])
        expect(shape, `${route.method} ${route.path} takes ${key}`).not.toHaveProperty(key);
    }
  });
  it("the three coordinate routes are POSTs with the point in the body", () => {
    expect(contract.places.nearest.method).toBe("POST");
    expect(contract.businesses.nearestPlaces.method).toBe("POST");
    expect(contract.businesses.listNear.method).toBe("POST");
    expect(contract.businesses.list.query.safeParse({ lat: 32.8 }).data).not.toHaveProperty("lat");
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

it("accepts a business summary with or without distance", () => {
  const base = {
    id: "1",
    slug: "a",
    name: { en: "A" },
    tagline: { en: "A" },
    tier: "example",
    primaryKindId: "k",
    placeId: "p",
    placeSlug: "sakhnin",
    lat: 1,
    lng: 2,
    photo: null,
    openNow: null,
    hours: { weekly: {}, exceptions: [] },
  };
  expect(BusinessSummarySchema.parse(base).distanceKm).toBeUndefined();
  // Browsers recompute open-now from the hours (Plan 4 Task 19), so every summary carries them.
  const { hours: _hours, ...withoutHours } = base;
  expect(() => BusinessSummarySchema.parse(withoutHours)).toThrow();
  expect(BusinessSummarySchema.parse({ ...base, distanceKm: 1.5 }).distanceKm).toBe(1.5);
  expect(() => BusinessSummarySchema.parse({ ...base, distanceKm: -1 })).toThrow();
});

describe("dietary (Task 27b)", () => {
  const base = {
    id: "1",
    slug: "a",
    name: { en: "A" },
    tagline: { en: "A" },
    tier: "darb",
    primaryKindId: "k",
    placeId: "p",
    placeSlug: "akko",
    lat: 1,
    lng: 2,
    photo: null,
    openNow: null,
    hours: { weekly: {}, exceptions: [] },
  };
  it("summaries carry the dietary set, empty when absent", () => {
    expect(BusinessSummarySchema.parse(base).dietary).toEqual([]);
    expect(BusinessSummarySchema.parse({ ...base, dietary: ["gluten_free"] }).dietary).toEqual([
      "gluten_free",
    ]);
    expect(() => BusinessSummarySchema.parse({ ...base, dietary: ["gluten_option"] })).toThrow();
  });
  it("lists filter by a dietary value, combinable with the others", () => {
    const query = contract.businesses.list.query;
    expect(
      query.parse({
        dietary: "gluten_free",
        openNow: "true",
        delivers: "true",
        lat: "32",
        lng: "35",
      }),
    ).toMatchObject({ dietary: "gluten_free", openNow: true, delivers: true });
    expect(query.safeParse({ dietary: "vegan-ish" }).success).toBe(false);
  });
});

describe("hours by appointment (Task 28)", () => {
  it("keeps the flag through parsing, and stays optional", () => {
    const hours = { weekly: {}, exceptions: [], byAppointment: true };
    expect(HoursSchema.parse(hours)).toEqual(hours);
    expect(HoursSchema.parse({ weekly: {}, exceptions: [] }).byAppointment).toBeUndefined();
  });
});

describe("the newer link fields", () => {
  it("normalise as typed and refuse what does not read", () => {
    const ok = LinksInputSchema.parse({
      linkedin: "linkedin.com/in/samer",
      youtube: "@darbcity",
      x: "@darb",
      telegram: "@darbcity",
      email: "Hi@Darb.co.il",
      booking: "book.example.com",
      wolt: "wolt.com/he/isr/haifa/restaurant/samer",
      phone2: "04-674 0000",
    });
    expect(ok).toMatchObject({
      linkedin: "https://www.linkedin.com/in/samer/",
      email: "mailto:hi@darb.co.il",
      booking: "https://book.example.com/",
      phone2: "tel:+97246740000",
    });
    expect(LinksSchema.parse(ok)).toEqual(ok);
    expect(LinksInputSchema.safeParse({ tenbis: "example.com" }).success).toBe(false);
    expect(LinksInputSchema.safeParse({ email: "nope" }).success).toBe(false);
  });
});
