import { describe, expect, it } from "vitest";
import { AdminPlanCreateSchema, AdminPlanPatchSchema, AdminTextPatchSchema } from "./admin.js";
import { contract } from "./contract.js";
import { CtaHrefSchema, PricingSchema } from "./pricing.js";

const plan = {
  slug: "spotlight",
  name: { en: "Spotlight" },
  tagline: {},
  monthly: 89,
  setup: null,
  priceNote: { en: "per month" },
  features: { he: [], ar: [], en: ["Featured in your town"] },
  highlighted: false,
  ctaLabel: { en: "Light me up" },
  ctaHref: "mailto:founder@darb.co.il?subject=Spotlight",
  finePrint: {},
  order: 2,
};

describe("plan schemas", () => {
  it("creates hidden by default, and takes live when asked", () => {
    expect(AdminPlanCreateSchema.parse(plan).status).toBe("hidden");
    expect(AdminPlanCreateSchema.parse({ ...plan, status: "live" }).status).toBe("live");
  });
  it("prices in whole, non-negative shekels; null is a custom quote", () => {
    expect(AdminPlanPatchSchema.safeParse({ monthly: null }).success).toBe(true);
    expect(AdminPlanPatchSchema.safeParse({ monthly: 0 }).success).toBe(true);
    expect(AdminPlanPatchSchema.safeParse({ monthly: 89.5 }).success).toBe(false);
    expect(AdminPlanPatchSchema.safeParse({ setup: -1 }).success).toBe(false);
  });
  it("links buttons to the web, mail or a path here, never a script or another host's //", () => {
    for (const ok of ["https://instagram.com/darbco", "mailto:founder@darb.co.il", "/for-business"])
      expect(CtaHrefSchema.safeParse(ok).success, ok).toBe(true);
    for (const bad of ["javascript:alert(1)", "//evil.example", "ftp://x", "founder@darb.co.il"])
      expect(CtaHrefSchema.safeParse(bad).success, bad).toBe(false);
  });
  it("refuses unknown fields and a slug change", () => {
    expect(AdminPlanPatchSchema.safeParse({ slug: "other" }).success).toBe(false);
    expect(AdminTextPatchSchema.safeParse({ value: {}, key: "x" }).success).toBe(false);
    expect(AdminTextPatchSchema.safeParse({ value: { en: "Plans" } }).success).toBe(true);
  });
});

describe("public pricing", () => {
  it("is GET /pricing and allows texts with no language at all", () => {
    expect(contract.pricing.get.path).toBe("/pricing");
    const { order: _o, ...rest } = plan;
    const page = { plans: [{ ...rest, id: "p", order: 1 }], texts: { "pricing.badge": {} } };
    expect(PricingSchema.safeParse(page).success).toBe(true);
  });
});
