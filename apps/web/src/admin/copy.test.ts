import { expect, it } from "vitest";
import { PRICING_TEXT_KEYS } from "@darb/contracts";
import { adminCopy, at, textLabel } from "./copy";

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

it("labels every pricing text in every locale, and shows an unknown key as it is", () => {
  for (const locale of ["he", "ar", "en"] as const)
    for (const key of PRICING_TEXT_KEYS) expect(textLabel(locale, key)).not.toBe(key);
  expect(textLabel("en", "pricing.title")).toBe("Title");
  expect(textLabel("en", "home.hero")).toBe("home.hero");
});
