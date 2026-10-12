import { describe, expect, it } from "vitest";
import { isSlug, toSlug } from "./slug.js";

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
