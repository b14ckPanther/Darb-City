import { LOCALES } from "@darb/core";
import { describe, expect, it } from "vitest";
import { deepSearch } from "./deep-search";

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("deep search copy", () => {
  it("has every line in every language, with the same placeholders", () => {
    for (const key of Object.keys(deepSearch.en) as (keyof typeof deepSearch.en)[])
      for (const locale of LOCALES) {
        expect(deepSearch[locale][key].trim()).not.toBe("");
        expect(placeholders(deepSearch[locale][key]), `${locale}.${key}`).toEqual(
          placeholders(deepSearch.en[key]),
        );
      }
  });
  it("speaks plainly: everyday Arabic, no dashes, no word for how search works", () => {
    for (const locale of LOCALES)
      for (const text of Object.values(deepSearch[locale])) {
        expect(text).not.toMatch(/[–—־]/);
        expect(text).not.toMatch(/\bAI\b|ذكاء|בינה|هلأ|هلقيت|halal|حلال|חלאל/i);
      }
    expect(deepSearch.ar.searchRelated).toBe("لسا ما لقينا {thing}. يمكن هدول يناسبوك:");
  });
});
