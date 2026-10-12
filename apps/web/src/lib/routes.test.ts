import { describe, expect, it } from "vitest";
import { href, languageAlternates, paths } from "./routes";

describe("href", () => {
  it("leaves Hebrew unprefixed and prefixes Arabic and English", () => {
    expect(href("he")).toBe("/");
    expect(href("ar")).toBe("/ar");
    expect(href("en", paths.kind("haifa", "beauty", "barbershops"))).toBe(
      "/en/haifa/beauty/barbershops",
    );
    expect(href("he", paths.nationalKind("barbershops"))).toBe("/k/barbershops");
    expect(href("ar", paths.placeKind("haifa", "barbershops"))).toBe("/ar/haifa/k/barbershops");
  });
});

describe("languageAlternates", () => {
  it("points every locale and x-default at the same path", () => {
    expect(languageAlternates(paths.place("haifa"))).toEqual({
      he: "/haifa",
      ar: "/ar/haifa",
      en: "/en/haifa",
      "x-default": "/haifa",
    });
  });
});
