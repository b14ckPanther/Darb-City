import { describe, expect, it } from "vitest";
import {
  AdminBusinessCreateSchema,
  AdminBusinessPatchSchema,
  AdminJoinRejectSchema,
} from "./admin.js";
import { JoinCreateSchema, JoinLookupRequestSchema, JoinSuggestionSchema } from "./join.js";
import { BusinessDetailSchema, CardStyleSchema, MediaKeySchema } from "./schemas.js";

const KEY = "pending/0190a000-0000-4000-8000-000000000001.webp";

const form = {
  name: { ar: "  حلويات سمير " },
  kindSlug: "bakeries",
  placeSlug: "sakhnin",
  lat: 32.8638,
  lng: 35.3023,
  phone: "050-123-4567",
  links: { instagram: "@samir.sweets", facebook: "facebook.com/samirsweets" },
  website: "samir.co.il",
  hours: { weekly: { "0": [{ open: "09:00", close: "18:00" }] }, exceptions: [] },
  photos: [KEY],
  owner: { name: "Samir", phone: "+972 50 123 4567" },
  source: "manual",
  locale: "ar",
};

describe("the join form", () => {
  it("normalises links and the website, trims names and fills defaults", () => {
    const parsed = JoinCreateSchema.parse(form);
    expect(parsed.name).toEqual({ ar: "حلويات سمير" });
    expect(parsed.links).toEqual({
      instagram: "https://www.instagram.com/samir.sweets/",
      facebook: "https://www.facebook.com/samirsweets",
    });
    expect(parsed.website).toBe("https://samir.co.il/");
    expect([parsed.whatsapp, parsed.logo, parsed.cardStyle, parsed.address]).toEqual([
      null,
      null,
      {},
      {},
    ]);
  });

  it("refuses what it cannot keep", () => {
    const bad = (patch: object) => JoinCreateSchema.safeParse({ ...form, ...patch }).success;
    expect(bad({ name: { he: " " } })).toBe(false);
    expect(bad({ lat: 40 })).toBe(false);
    expect(bad({ links: { instagram: "https://evil.example/x" } })).toBe(false);
    expect(bad({ links: { myspace: "x" } })).toBe(false);
    expect(bad({ photos: Array(7).fill(KEY) })).toBe(false);
    expect(bad({ photos: ["../secret.webp"] })).toBe(false);
    expect(bad({ cardStyle: { accent: "#123456" } })).toBe(false);
    expect(bad({ owner: { name: "S", phone: "050-123-4567" } })).toBe(false);
    expect(bad({ owner: { name: "Samir", phone: "call me" } })).toBe(false);
    expect(bad({ source: "ai" })).toBe(false);
  });

  it("takes a lookup with at least one thing to look up", () => {
    expect(JoinLookupRequestSchema.safeParse({ locale: "he" }).success).toBe(false);
    expect(JoinLookupRequestSchema.safeParse({ query: "x", locale: "he" }).success).toBe(true);
    expect(
      JoinLookupRequestSchema.safeParse({ point: { lat: 32.8, lng: 35.3 }, locale: "en" }).success,
    ).toBe(true);
    expect(JoinSuggestionSchema.parse({ found: false, reason: "off" })).toEqual({
      found: false,
      reason: "off",
      sources: [],
      osm: false,
    });
  });
});

describe("card fields", () => {
  it("accepts only media keys this API hands out", () => {
    expect(MediaKeySchema.safeParse(KEY).success).toBe(true);
    expect(MediaKeySchema.safeParse("pending/x.webp").success).toBe(false);
    expect(MediaKeySchema.safeParse(`b/${KEY}`).success).toBe(false);
    expect(CardStyleSchema.safeParse({ accent: "#d9a54c", icons: "solid" }).success).toBe(true);
  });

  it("are optional on a public business (older rows) and patchable in admin", () => {
    const detail = BusinessDetailSchema.shape;
    expect(detail.links.parse(undefined)).toEqual({});
    expect(detail.logo.parse(undefined)).toBeNull();
    expect(
      AdminBusinessPatchSchema.parse({ links: { tiktok: "@samir" }, logo: { key: KEY } }),
    ).toEqual({ links: { tiktok: "https://www.tiktok.com/@samir" }, logo: { key: KEY } });
    expect(AdminBusinessCreateSchema.shape.photos.parse(undefined)).toEqual([]);
    expect(AdminJoinRejectSchema.safeParse({ reason: "" }).success).toBe(false);
  });
});
