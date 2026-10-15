import { describe, expect, it } from "vitest";
import { href, localeHref, languageAlternates, paths } from "./routes";

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

describe("listed business", () => {
  it("is the plain business path in the listed place itself", () => {
    expect(paths.listedBusiness("haifa", "beauty", "barbershops", "haifa", "samers")).toEqual(
      paths.business("haifa", "beauty", "barbershops", "samers"),
    );
  });
  it("names the business's own place when it lives beneath the listed one", () => {
    expect(
      href("en", paths.listedBusiness("haifa", "beauty", "barbershops", "kiryat-haim", "samers")),
    ).toBe("/en/haifa/beauty/barbershops/kiryat-haim/samers");
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

describe("localeHref", () => {
  it("puts a plan button's path into the locale's URL space", () => {
    expect(localeHref("he", "/contact?plan=spotlight")).toBe("/contact?plan=spotlight");
    expect(localeHref("en", "/contact?plan=spotlight")).toBe("/en/contact?plan=spotlight");
    expect(localeHref("ar", "/")).toBe("/ar");
  });
});
