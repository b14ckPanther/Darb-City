import { describe, expect, it } from "vitest";
import { isReservedSlug, isSlug, RESERVED_SLUGS, toSlug } from "./slug.js";

describe("toSlug", () => {
  it.each([
    ["Haifa", "haifa"],
    ["AKKO", "akko"],
    ["Kiryat Ata", "kiryat-ata"],
    ["Ma'alot-Tarshiha", "maalot-tarshiha"],
    ["TAMRA (YIZRE'EL)", "tamra-yizreel"],
    ["Café & Co.", "cafe-co"],
    ["  Judeida–Makr  ", "judeida-makr"],
  ])("%s → %s", (input, expected) => {
    expect(toSlug(input)).toBe(expected);
  });
  it("throws when nothing Latin remains", () => {
    expect(() => toSlug("חיפה")).toThrow(/slug/);
  });
});

describe("isSlug", () => {
  it("accepts lowercase words joined by single hyphens", () => {
    expect(isSlug("kiryat-ata")).toBe(true);
    expect(isSlug("a1")).toBe(true);
  });
  it.each(["Kiryat-ata", "kiryat--ata", "-haifa", "haifa-", "", "חיפה"])("rejects %s", (value) => {
    expect(isSlug(value)).toBe(false);
  });
});

describe("reserved slugs", () => {
  it("cover locales, the kind prefix and app routes", () => {
    expect([...RESERVED_SLUGS].sort()).toEqual(
      [
        "ar",
        "en",
        "he",
        "k",
        "admin",
        "api",
        "for-business",
        "search",
        "login",
        "register",
        "_next",
        "brand",
        "accessibility",
        "terms",
        "privacy",
      ].sort(),
    );
  });
  it.each(["ar", "he", "k", "admin", "for-business", "_next", "brand"])(
    "%s is reserved",
    (value) => {
      expect(isReservedSlug(value)).toBe(true);
    },
  );
  it.each(["haifa", "barbershops", "beauty", "arraba", "kiryat-haim", "AR"])(
    "%s is not reserved",
    (value) => {
      expect(isReservedSlug(value)).toBe(false);
    },
  );
});
