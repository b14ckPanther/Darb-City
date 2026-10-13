import { expect, it } from "vitest";
import { adminCopy, at } from "./copy";

it("has every key in every locale, never empty, and never the word halal", () => {
  const keys = Object.keys(adminCopy.en).sort();
  for (const locale of ["he", "ar", "en"] as const) {
    expect(Object.keys(adminCopy[locale]).sort()).toEqual(keys);
    for (const v of Object.values(adminCopy[locale])) {
      expect(v.trim()).not.toBe("");
      expect(v).not.toMatch(/halal|חלאל|حلال/i);
    }
  }
});

it("fills variables", () => {
  expect(at("en", "reportDays", { days: 30 })).toBe("Last 30 days");
});
