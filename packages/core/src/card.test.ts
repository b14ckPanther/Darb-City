import { describe, expect, it } from "vitest";
import {
  CARD_ACCENTS,
  facebookUrl,
  googleMapsUrl,
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

  it.each([
    "https://www.google.com/maps/place/Falafel/@32.8,35.0,17z/data=!3d32.8!4d35.0",
    "https://google.co.il/maps/place/Falafel",
    "https://maps.google.com/?cid=123",
    "maps.app.goo.gl/AbC123",
    "https://goo.gl/maps/AbC123",
  ])("a Google Maps link %s is kept", (raw) => {
    expect(googleMapsUrl(raw)).toMatch(/^https:\/\//);
  });

  it.each([
    "https://www.google.com/search?q=falafel",
    "https://google.com/",
    "https://goo.gl/AbC123",
    "https://maps.app.goo.gl/",
    "https://evil.example/maps/place/x",
    "https://maps.google.evil.example/x",
    "https://google.com.evil.example/maps/x",
    "javascript:alert(1)",
    "not a link",
  ])("refuses %s as a Google Maps link", (raw) => expect(googleMapsUrl(raw)).toBeNull());

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

describe("more links", () => {
  it("reads LinkedIn pages and refuses other hosts or bare names", async () => {
    const { linkedinUrl } = await import("./card");
    expect(linkedinUrl("linkedin.com/in/samer-k")).toBe("https://www.linkedin.com/in/samer-k/");
    expect(linkedinUrl("https://il.linkedin.com/company/darb?trk=x")).toBe(
      "https://www.linkedin.com/company/darb/",
    );
    expect(linkedinUrl("samer")).toBeNull();
    expect(linkedinUrl("https://evil.com/in/samer")).toBeNull();
  });

  it("reads YouTube, X and Telegram handles and links", async () => {
    const { telegramUrl, xUrl, youtubeUrl } = await import("./card");
    expect(youtubeUrl("@darbcity")).toBe("https://www.youtube.com/@darbcity");
    expect(youtubeUrl("youtu.be/abc123")).toBe("https://youtu.be/abc123");
    expect(youtubeUrl("https://youtube.com/")).toBeNull();
    expect(xUrl("@darb_city")).toBe("https://x.com/darb_city");
    expect(xUrl("https://twitter.com/darb_city/")).toBe("https://x.com/darb_city");
    expect(xUrl("https://x.com/a/status/1")).toBeNull();
    expect(telegramUrl("@darbcity")).toBe("https://t.me/darbcity");
    expect(telegramUrl("t.me/darbcity")).toBe("https://t.me/darbcity");
    expect(telegramUrl("abc")).toBeNull();
  });

  it("reads an email, a delivery page and a second phone", async () => {
    const { emailHref, phoneHref, tenbisUrl, woltUrl } = await import("./card");
    expect(emailHref(" Hello@Darb.co.il ")).toBe("mailto:hello@darb.co.il");
    expect(emailHref("mailto:a@b.co")).toBe("mailto:a@b.co");
    expect(emailHref("not an email")).toBeNull();
    expect(woltUrl("wolt.com/he/isr/haifa/restaurant/samer")).toBe(
      "https://wolt.com/he/isr/haifa/restaurant/samer",
    );
    expect(woltUrl("https://example.com/wolt")).toBeNull();
    expect(tenbisUrl("https://www.10bis.co.il/next/restaurants/menu/delivery/1/samer")).toBe(
      "https://www.10bis.co.il/next/restaurants/menu/delivery/1/samer",
    );
    expect(phoneHref("04-674 0000")).toBe("tel:+97246740000");
    expect(phoneHref("+972 50 123 4567")).toBe("tel:+972501234567");
    expect(phoneHref("call me")).toBeNull();
  });

  it("normalises every new key, and drops what does not read", async () => {
    const { normalizeLinks } = await import("./card");
    expect(
      normalizeLinks({
        x: "@darb",
        email: "a@b.co",
        booking: "book.example.com/samer",
        order: "nope nope",
        phone2: "050-1234567",
      }),
    ).toEqual({
      x: "https://x.com/darb",
      email: "mailto:a@b.co",
      booking: "https://book.example.com/samer",
      phone2: "tel:+972501234567",
    });
  });
});
