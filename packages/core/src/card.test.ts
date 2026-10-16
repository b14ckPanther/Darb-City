import { describe, expect, it } from "vitest";
import {
  CARD_ACCENTS,
  facebookUrl,
  instagramUrl,
  latinize,
  normalizeLinks,
  tiktokUrl,
  wazeDirections,
  wazeUrl,
  websiteUrl,
} from "./card.js";
import { toSlug } from "./slug.js";

describe("links", () => {
  it.each([
    ["@Samir.Sweets", "https://www.instagram.com/samir.sweets/"],
    ["samir_sweets", "https://www.instagram.com/samir_sweets/"],
    ["https://instagram.com/samir?igsh=abc", "https://www.instagram.com/samir/"],
    ["www.instagram.com/samir/", "https://www.instagram.com/samir/"],
  ])("instagram %s", (raw, out) => expect(instagramUrl(raw)).toBe(out));

  it("refuses what is not that network", () => {
    expect(instagramUrl("https://evil.example/samir")).toBeNull();
    expect(instagramUrl("two words")).toBeNull();
    expect(facebookUrl("https://facebook.com/")).toBeNull();
    expect(tiktokUrl("https://instagram.com/x")).toBeNull();
    expect(wazeUrl("https://maps.google.com")).toBeNull();
    expect(websiteUrl("javascript:alert(1)")).toBeNull();
    expect(websiteUrl("not a site")).toBeNull();
  });

  it.each([
    ["samirsweets", "https://www.facebook.com/samirsweets"],
    ["https://m.facebook.com/samirsweets/?ref=x", "https://www.facebook.com/samirsweets"],
    [
      "https://www.facebook.com/profile.php?id=1000&x=1",
      "https://www.facebook.com/profile.php?id=1000",
    ],
  ])("facebook %s", (raw, out) => expect(facebookUrl(raw)).toBe(out));

  it("tiktok, waze and websites", () => {
    expect(tiktokUrl("@Samir")).toBe("https://www.tiktok.com/@samir");
    expect(tiktokUrl("https://www.tiktok.com/@samir/video/1")).toBe(
      "https://www.tiktok.com/@samir",
    );
    expect(wazeUrl("https://waze.com/ul?ll=32.1,35.2")).toBe("https://waze.com/ul?ll=32.1,35.2");
    expect(websiteUrl("samir.co.il")).toBe("https://samir.co.il/");
    expect(websiteUrl("http://samir.co.il/menu")).toBe("https://samir.co.il/menu");
    expect(wazeDirections(32.86, 35.3)).toBe(
      "https://waze.com/ul?ll=32.860000,35.300000&navigate=yes",
    );
  });

  it("normalizes a set and drops the rest", () => {
    expect(
      normalizeLinks({ instagram: "@a.b", facebook: "", tiktok: "no way", waze: null }),
    ).toEqual({
      instagram: "https://www.instagram.com/a.b/",
    });
  });

  it("has eight lower-case accents", () => {
    expect(CARD_ACCENTS).toHaveLength(8);
    for (const a of CARD_ACCENTS) expect(a).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("latinize", () => {
  it("turns Hebrew and Arabic names into slugs", () => {
    expect(toSlug(latinize("מספרת שלום"))).toBe("msprt-shlvm");
    expect(toSlug(latinize("حلويات سمير"))).toBe("hlwyat-smyr");
    expect(toSlug(latinize("Café سمير 2"))).toBe("cafe-smyr-2");
  });
});
