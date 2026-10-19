import { expect, it } from "vitest";
import { helperCopy, ht } from "./copy";

it("has every key in every locale, never empty", () => {
  const keys = Object.keys(helperCopy.en).sort();
  for (const locale of ["he", "ar", "en"] as const) {
    expect(Object.keys(helperCopy[locale]).sort()).toEqual(keys);
    for (const v of Object.values(helperCopy[locale])) expect(v.trim()).not.toBe("");
  }
});

it("follows Darb's copy rules: no dashes or maqaf, no AI or halal, no language names", () => {
  for (const locale of ["he", "ar", "en"] as const)
    for (const v of Object.values(helperCopy[locale])) {
      expect(v).not.toMatch(/[–—־]/);
      expect(v).not.toMatch(/\bAI\b|هلأ|هلقيت|halal|חלאל|حلال/i);
      expect(v).not.toMatch(/Hebrew|Arabic|English|עברית|ערבית|אנגלית|عربي|عبري|انجليزي|إنجليزي/i);
    }
});

it("fills variables and keeps the same ones in every locale", () => {
  expect(ht("en", "mineSummary", { total: 23, live: 18 })).toBe("You added 23 · 18 live");
  const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  for (const key of Object.keys(helperCopy.en) as (keyof typeof helperCopy.en)[])
    for (const locale of ["he", "ar"] as const)
      expect(vars(helperCopy[locale][key]), `${locale} ${key}`).toEqual(vars(helperCopy.en[key]));
});
