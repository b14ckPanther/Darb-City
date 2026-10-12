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
