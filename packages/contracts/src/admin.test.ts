import { describe, expect, it } from "vitest";
import {
  AdminBusinessCreateSchema,
  AdminBusinessPatchSchema,
  AdminKindCreateSchema,
  AdminPlaceCreateSchema,
  AdminPlacePatchSchema,
  AdminStatusSchema,
  adminContract,
} from "./admin.js";
import { contract } from "./contract.js";

const hours = { weekly: { "0": [{ open: "09:00", close: "18:00" }] }, exceptions: [] };
const business = {
  slug: "caramel",
  placeId: "0190a000-0000-7000-8000-000000000001",
  name: { he: "קרמל" },
  tagline: { he: "מסעדה" },
  address: { he: "רחוב 1" },
  primaryKindId: "0190a000-0000-7000-8000-000000000002",
  kindIds: [],
  lat: 32.9,
  lng: 35.1,
  phone: "+972 4-123-4567",
  whatsapp: null,
  website: "https://caramel.darb.co.il",
  hours,
  attributes: { delivers: true },
  experience: { any: "thing" },
  tier: "darb",
  apps: { web: "https://caramel.darb.co.il" },
};

describe("admin schemas", () => {
  it("accepts a full business and defaults it to draft", () => {
    expect(AdminBusinessCreateSchema.parse(business).status).toBe("draft");
  });
  it("rejects non-http links, bad phones and reserved slugs", () => {
    expect(
      AdminBusinessCreateSchema.safeParse({ ...business, website: "javascript:alert(1)" }).success,
    ).toBe(false);
    expect(
      AdminBusinessCreateSchema.safeParse({ ...business, apps: { ios: "ftp://x" } }).success,
    ).toBe(false);
    expect(AdminBusinessCreateSchema.safeParse({ ...business, phone: "call me" }).success).toBe(
      false,
    );
    expect(
      AdminPlaceCreateSchema.safeParse({
        slug: "admin",
        type: "town",
        parentId: business.placeId,
        name: { en: "x" },
        lat: 32.8,
        lng: 35.2,
      }).success,
    ).toBe(false);
  });
  it("keeps places inside Israel and refuses unknown patch fields", () => {
    const place = {
      slug: "new-town",
      type: "town",
      parentId: business.placeId,
      name: { en: "x" },
      lat: 40,
      lng: 35.2,
    };
    expect(AdminPlaceCreateSchema.safeParse(place).success).toBe(false);
    expect(AdminPlacePatchSchema.safeParse({ slug: "renamed" }).success).toBe(false);
    expect(AdminPlacePatchSchema.safeParse({ status: "live" }).success).toBe(true);
    expect(AdminBusinessPatchSchema.safeParse({ placeId: business.placeId }).success).toBe(false);
  });
  it("new kinds start hidden: a create body cannot set status", () => {
    const kind = {
      slug: "beard-studios",
      sectorId: business.placeId,
      name: { en: "Beard studios" },
      synonyms: { he: [], ar: [], en: [] },
      template: "booking",
      order: 50,
    };
    expect(AdminKindCreateSchema.parse(kind)).not.toHaveProperty("status");
    expect(AdminKindCreateSchema.safeParse({ ...kind, status: "active" }).success).toBe(false);
    expect(AdminKindCreateSchema.safeParse({ ...kind, status: "hidden" }).success).toBe(false);
  });
  it("status bodies take an optional immediate flag", () => {
    expect(AdminStatusSchema.parse({ status: "suspended" })).toEqual({ status: "suspended" });
  });
  it("is mounted on the main contract", () => {
    expect(contract.admin).toEqual(adminContract);
    expect(contract.admin.businesses.status.path).toBe("/admin/businesses/:id/status");
  });
});

describe("admin dietary (Task 27b)", () => {
  it("creates with no dietary facts by default and accepts gluten_free", () => {
    expect(AdminBusinessCreateSchema.parse(business).dietary).toEqual([]);
    expect(
      AdminBusinessCreateSchema.parse({ ...business, dietary: ["gluten_free"] }).dietary,
    ).toEqual(["gluten_free"]);
    expect(AdminBusinessCreateSchema.safeParse({ ...business, dietary: ["x"] }).success).toBe(
      false,
    );
  });
  it("a patch without dietary never touches it", () => {
    expect(AdminBusinessPatchSchema.parse({ phone: null })).toEqual({ phone: null });
    expect(AdminBusinessPatchSchema.parse({ dietary: [] })).toEqual({ dietary: [] });
  });
});
