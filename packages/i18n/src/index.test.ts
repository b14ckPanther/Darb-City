import { LOCALES } from "@darb/core";
import { describe, expect, it } from "vitest";
import { dir, messages, t } from "./index.js";

it("has the same non-empty keys in every locale", () => {
  const keys = Object.keys(messages.en).sort();
  for (const locale of LOCALES) {
    expect(Object.keys(messages[locale]).sort()).toEqual(keys);
    for (const key of keys)
      expect(messages[locale][key as keyof typeof messages.en].trim()).not.toBe("");
  }
});

it("reads Hebrew and Arabic right to left", () => {
  expect(dir("he")).toBe("rtl");
  expect(dir("ar")).toBe("rtl");
  expect(dir("en")).toBe("ltr");
});

describe("t", () => {
  it("returns the message for the locale", () => {
    expect(t("en", "nearMe")).toBe("Near me");
    expect(t("he", "appName")).toBe(messages.he.appName);
  });
  it("fills {name} placeholders from vars", () => {
    expect(t("en", "noneHereYet", { place: "Sakhnin" })).toBe("None in Sakhnin yet");
    expect(t("he", "noneHereYet", { place: "סח'נין" })).toBe("עוד אין בסח'נין");
    expect(t("ar", "noneHereYet", { place: "سخنين" })).toContain("سخنين");
  });
  it("leaves a placeholder with no matching var as-is", () => {
    expect(t("en", "noneHereYet")).toBe("None in {place} yet");
    expect(t("en", "noneHereYet", { other: "x" })).toBe("None in {place} yet");
  });
  it("accepts numbers", () => {
    expect(t("en", "noneHereYet", { place: 7 })).toBe("None in 7 yet");
  });
});

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

it("uses the same placeholders in every locale", () => {
  for (const key of Object.keys(messages.en) as (keyof typeof messages.en)[]) {
    const expected = placeholders(messages.en[key]);
    for (const locale of LOCALES)
      expect(placeholders(messages[locale][key]), `${locale}.${key}`).toEqual(expected);
  }
});

it("fills the web city messages", () => {
  expect(t("en", "kindInPlace", { kind: "Barbershops", place: "Sakhnin" })).toBe(
    "Barbershops in Sakhnin",
  );
  expect(t("ar", "businessCount", { count: 3 })).toBe("عدد المصالح: 3");
  expect(t("he", "allOf", { place: "חיפה" })).toBe("כל חיפה");
});

describe("stage copy", () => {
  it("names the map, the plaza and the Map/List switch in every language", () => {
    expect(t("en", "mapLabel")).toBe("Map of Darb's live places");
    expect(t("en", "plazaLabel", { place: "Sakhnin" })).toBe("Sakhnin: streets and doors");
    expect(t("he", "plazaLabel", { place: "סח'נין" })).toBe("סח'נין: רחובות ודלתות");
    expect(t("ar", "plazaLabel", { place: "سخنين" })).toBe("سخنين: الشوارع والأبواب");
    expect([t("he", "showMap"), t("ar", "showMap"), t("en", "showMap")]).toEqual([
      "מפה",
      "خريطة",
      "Map",
    ]);
    expect([t("he", "showList"), t("ar", "showList"), t("en", "showList")]).toEqual([
      "רשימה",
      "قائمة",
      "List",
    ]);
  });
});
