import { expect, it } from "vitest";
import { authCopy, fill } from "./auth-copy";

it("has every key in every locale, never empty", () => {
  const keys = Object.keys(authCopy.en).sort();
  for (const locale of ["he", "ar", "en"] as const) {
    expect(Object.keys(authCopy[locale]).sort()).toEqual(keys);
    for (const v of Object.values(authCopy[locale])) expect(v.trim()).not.toBe("");
  }
});

it("follows Darb's copy rules: no dashes or maqaf, no AI or halal, no language names", () => {
  for (const locale of ["he", "ar", "en"] as const)
    for (const v of Object.values(authCopy[locale])) {
      expect(v).not.toMatch(/[–—־]/);
      expect(v).not.toMatch(/\bAI\b|هلأ|هلقيت|halal|חלאל|حلال/i);
      expect(v).not.toMatch(/Hebrew|Arabic|English|עברית|ערבית|אנגלית|عربي|عبري|انجليزي|إنجليزي/i);
    }
});

it("keeps the same variables in every locale and fills them", () => {
  const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  for (const key of Object.keys(authCopy.en) as (keyof typeof authCopy.en)[])
    for (const locale of ["he", "ar"] as const)
      expect(vars(authCopy[locale][key]), `${locale} ${key}`).toEqual(vars(authCopy.en[key]));
  expect(fill(authCopy.en.resendIn, { s: "0:30" })).toBe("New code in 0:30");
});
