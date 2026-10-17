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
    expect(t("en", "plazaLabel", { place: "Sakhnin" })).toBe("Sakhnin: categories");
    expect(t("he", "plazaLabel", { place: "סח'נין" })).toBe("סח'נין: קטגוריות");
    expect(t("ar", "plazaLabel", { place: "سخنين" })).toBe("سخنين: الفئات");
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

describe("search copy", () => {
  it("never brands Darb or a blocked search with religion", () => {
    for (const locale of LOCALES)
      for (const text of Object.values(messages[locale]))
        // Whole words only: "دين" alone, never inside مدينة (city).
        expect(text, text).not.toMatch(
          /halal|חלאל|حلال|kosher|כשר|religio|(^|\s)(דת|دين|الدين)(\s|$)/i,
        );
  });
  it("says only that the kind is not listed", () => {
    expect(t("en", "blocked")).toBe("We don't list this kind of business.");
    expect(t("he", "blocked")).toBe("אנחנו לא מציגים סוג עסק כזה.");
    expect(t("ar", "blocked")).toBe("لا نعرض هذا النوع من المصالح.");
  });
  it("reads naturally where the review asked", () => {
    expect(t("ar", "noSuggestions")).toBe("لا توجد اقتراحات");
    expect(t("he", "nationwide")).toBe(t("he", "kindNationwide", { kind: "" }).trim());
    expect(t("he", "searchUnavailable")).toMatch(/במקום זאת\.$/);
  });
  it("says honestly when the asked thing came from further away or is not there", () => {
    const vars = {
      thing: "gluten-free shawarma",
      place: "Karmiel",
      name: "Caramel",
      where: "Akko",
      distance: "24 km",
    };
    expect(t("en", "searchWider", vars)).toBe(
      "No gluten-free shawarma in Karmiel. Closest: Caramel, Akko, 24 km",
    );
    expect(t("he", "thingGlutenFree", { thing: "שווארמה" })).toBe("שווארמה ללא גלוטן");
    expect(t("ar", "searchRelated", { thing: "سوشي" })).toBe(
      "لسا ما لقينا سوشي. يمكن هدول يناسبوك:",
    );
    // Colloquial Arabic, no dashes, and no word for how the search works.
    for (const key of ["searchWider", "searchWiderNear", "searchRelated", "matchedOn"] as const)
      for (const locale of LOCALES) {
        expect(t(locale, key)).not.toMatch(/[\u2013\u2014\u05BE]|\bAI\b|ذكاء|בינה/);
        expect(t(locale, key)).not.toMatch(/هلأ|هلقيت/);
      }
  });
  it("fills the chip and query placeholders", () => {
    expect(t("en", "removeChip", { chip: "Open now" })).toBe("Remove Open now");
    expect(t("ar", "searchFor", { q: "حلاق" })).toContain("حلاق");
  });
});
