import { LOCALES } from "@darb/core";
import { expect, it } from "vitest";
import { loadPlans, loadTexts } from "./index.js";

const plans = loadPlans();
const texts = loadTexts();
const every = (value: Partial<Record<string, string>>) =>
  LOCALES.every((l) => (value[l] ?? "").trim() !== "");

it("has unique plans, in order, with exactly one highlighted", () => {
  expect(new Set(plans.map((p) => p.slug)).size).toBe(plans.length);
  expect(plans.map((p) => p.order)).toEqual([...plans.map((p) => p.order)].sort((a, b) => a - b));
  expect(plans.filter((p) => p.highlighted)).toHaveLength(1);
});

it("says every plan in Hebrew, Arabic and English, with as many features in each", () => {
  for (const p of plans) {
    for (const field of [p.name, p.tagline, p.ctaLabel, p.priceNote, p.finePrint])
      expect(every(field), p.slug).toBe(true);
    expect(p.features.he.length, p.slug).toBeGreaterThan(0);
    expect([p.features.ar.length, p.features.en.length], p.slug).toEqual([
      p.features.he.length,
      p.features.he.length,
    ]);
  }
});

it("prices in whole shekels and links only to mail, https or a path", () => {
  for (const p of plans) {
    for (const price of [p.monthly, p.setup])
      if (price !== null) expect(Number.isInteger(price) && price >= 0, p.slug).toBe(true);
    expect(p.ctaHref, p.slug).toMatch(/^(?:https:\/\/|mailto:|\/(?!\/))/);
  }
});

it("has every page text in every language, the same FAQ in each, and never the word halal", () => {
  expect(new Set(texts.map((t) => t.key)).size).toBe(texts.length);
  for (const t of texts) expect(every(t.value), t.key).toBe(true);
  const faq = texts.find((t) => t.key === "pricing.faq")!.value;
  const entries = LOCALES.map((l) => faq[l]!.split(/\n\s*\n/).length);
  expect(new Set(entries).size).toBe(1);
  expect(JSON.stringify([plans, texts])).not.toMatch(/halal|חלאל|حلال/i);
});

it("never names languages: more are coming, so the copy says any language", () => {
  expect(JSON.stringify([plans, texts])).not.toMatch(
    /Hebrew|Arabic|English|עברית|ערבית|אנגלית|العربية|العبرية|الإنجليزية/,
  );
});

it("never uses long dashes or the maqaf: the owner's copy uses a hyphen, a comma or a period", () => {
  expect(JSON.stringify([plans, texts])).not.toMatch(/[\u2013\u2014\u05be]/);
});
