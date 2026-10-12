import { expect, it } from "vitest";
import { normalize } from "./normalize.js";
import { STOPWORDS, tokenize, variants } from "./tokens.js";

it("splits normalized text", () => {
  expect(tokenize(normalize("Barber  in Haifa"))).toEqual(["barber", "in", "haifa"]);
  expect(tokenize("")).toEqual([]);
});
it("knows stopwords in three languages", () => {
  for (const w of ["in", "near", "the", "ליד", "של", "في", "عند", "بدي"])
    expect(STOPWORDS.has(normalize(w)), w).toBe(true);
});
it("strips attached Hebrew prefixes", () => {
  expect(variants(normalize("בסחנין"))).toContain(normalize("סחנין"));
  expect(variants(normalize("והמספרה"))).toContain(normalize("מספרה"));
});
it("strips attached Arabic prefixes", () => {
  expect(variants(normalize("بسخنين"))).toContain(normalize("سخنين"));
  expect(variants(normalize("والحلويات"))).toContain(normalize("حلويات"));
  expect(variants(normalize("للحلاق"))).toContain(normalize("حلاق"));
});
it("keeps the whole token first and never strips below two letters", () => {
  expect(variants("בר")).toEqual(["בר"]);
  expect(variants("haifa")).toEqual(["haifa"]);
});
