// @vitest-environment node
import { expect, it } from "vitest";
import type { BusinessLevel } from "@/lib/levels";
import { businessLevelMetadata } from "./BusinessLevelView";

const level = (tier: "example" | "verified") =>
  ({
    locale: "en",
    home: { name: { en: "Sakhnin" } },
    kind: { name: { en: "Barbershops" } },
    business: { name: { en: "Abu Salim" }, tagline: { en: "Fades" }, tier },
    canonical: ["sakhnin", "beauty", "barbershops", "abu-salim"],
  }) as unknown as BusinessLevel;

it("keeps showroom examples out of search engines, real businesses in", () => {
  expect(businessLevelMetadata(level("example")).robots).toEqual({ index: false, follow: true });
  expect(businessLevelMetadata(level("verified")).robots).toBeUndefined();
});
