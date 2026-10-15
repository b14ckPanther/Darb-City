import type { PlanDto } from "@darb/contracts";
import { describe, expect, it } from "vitest";
import {
  faqEntries,
  formatShekels,
  priceLabel,
  pricingText,
  shekelParts,
  textLines,
} from "./pricing";

const texts = {
  "pricing.free": { he: "חינם", en: "Free" },
  "pricing.custom": { en: "Let's talk" },
};
const plan = (monthly: number | null) => ({ monthly }) as PlanDto;

describe("pricing helpers", () => {
  it("formats whole shekels with the sign, in each locale's order and Latin digits", () => {
    expect(formatShekels(349, "en")).toBe("₪349");
    expect(formatShekels(1200, "he")).toContain("1,200");
    expect(formatShekels(89, "ar")).toContain("89");
    expect(shekelParts(89, "he").filter((p) => p.currency)).toEqual([
      { text: "₪", currency: true },
    ]);
  });

  it("says free, an amount or the custom label", () => {
    expect(priceLabel(plan(0), texts, "he")).toEqual({ kind: "free", text: "חינם" });
    expect(priceLabel(plan(89), texts, "he")).toEqual({ kind: "amount", value: 89 });
    // Not translated yet: falls back like every Localized text.
    expect(priceLabel(plan(null), texts, "ar")).toEqual({ kind: "custom", text: "Let's talk" });
    // A free plan with no "Free" text shows the amount itself.
    expect(priceLabel(plan(0), {}, "en")).toEqual({ kind: "amount", value: 0 });
  });

  it("reads a missing text as empty", () => {
    expect(pricingText({}, "pricing.title", "en")).toBe("");
  });

  it("splits terms by line and the FAQ by blank line", () => {
    expect(textLines(" One \r\n\nTwo\n")).toEqual(["One", "Two"]);
    expect(
      faqEntries("Need a site?\nNo.\n\n  \nCan I grow?\nYes.\nAnytime.\n\nHalf a question"),
    ).toEqual([
      { question: "Need a site?", answer: "No." },
      { question: "Can I grow?", answer: "Yes. Anytime." },
    ]);
  });
});
