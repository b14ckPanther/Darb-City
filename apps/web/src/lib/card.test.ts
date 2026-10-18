import { describe, expect, it } from "vitest";
import { CARD_ACCENTS } from "@darb/core";
import { card as copy } from "@/content/card";
import { detail } from "./fixtures/business";
import { cardColors, cardFromBusiness, cardFromDraft } from "./card";
import { contrastRatio } from "./contrast";

const card = (over: Parameters<typeof detail>[0] = {}, ctaLabel: string | null = null) =>
  cardFromBusiness({
    locale: "en",
    copy: copy.en,
    business: detail(over),
    kindName: "Restaurants",
    placeName: "Akko",
    sectorAccent: "#d6a473",
    ctaLabel,
    shareUrl: "https://darb.co.il/en/akko/food/restaurants/caramel",
  });

describe("card colours", () => {
  it("reads at least 4.5:1 on every accent an owner can pick", () => {
    for (const accent of CARD_ACCENTS) {
      const { ink, contrast } = cardColors(accent, "#d6a473");
      expect(contrast, accent).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(accent, ink)).toBe(contrast);
    }
  });
  it("falls back to the sector's colour for no accent or a malformed one", () => {
    expect(cardColors(undefined, "#93c1b3").accent).toBe("#93c1b3");
    expect(cardColors("red", "#93c1b3").accent).toBe("#93c1b3");
    // A dark sector colour takes white ink.
    expect(cardColors(undefined, "#1d3b2f").ink).toBe("#ffffff");
  });
});

describe("cardFromBusiness", () => {
  it("lists each link once, in the order people reach for them", () => {
    const c = card({
      whatsapp: "+972 50-123-4567",
      website: "https://caramel.co.il",
      tier: "verified",
    });
    expect(c.primary.kind).toBe("whatsapp");
    expect(c.ctaLabel).toBe("WhatsApp");
    // WhatsApp is the main button, so the row does not repeat it.
    expect(c.actions.map((a) => a.key)).toEqual(["call", "waze", "maps", "website"]);
  });
  it("lists a Darb client's website once, as its app, and its other apps after", () => {
    const c = card(
      {
        apps: { web: "https://caramel.darb.co.il", ios: "https://apps.apple.com/app/id1" },
        website: "https://caramel.darb.co.il",
      },
      "Open menu",
    );
    expect(c.ctaLabel).toBe("Open menu");
    expect(c.actions.map((a) => [a.key, a.href])).toEqual([
      ["call", "tel:+972524382229"],
      ["waze", "https://waze.com/ul?ll=32.92,35.07&navigate=yes"],
      ["maps", "https://www.google.com/maps/dir/?api=1&destination=32.92,35.07"],
      ["app", "https://apps.apple.com/app/id1"],
    ]);
  });
  it("keeps a home business's street and way there private", () => {
    const c = card({ attributes: { addressHidden: true }, address: { en: "Olive St 4" } });
    expect(c.address).toBeNull();
    // The call is the main button; nothing else leads there.
    expect(c.primary.kind).toBe("call");
    expect(c.actions).toEqual([]);
  });
  it("adds Google reviews last, only with a Google Maps link, never for a private street", () => {
    const google = "https://www.google.com/maps/place/Caramel/data=!3d32.92!4d35.07";
    expect(card().actions.map((a) => a.key)).not.toContain("reviews");
    const c = card({ links: { google } });
    expect(c.actions.at(-1)).toEqual({
      key: "reviews",
      icon: "star",
      label: "Google reviews",
      href: google,
    });
    expect(
      card({ links: { google: "https://evil.example/maps/place/x" } }).actions.map((a) => a.key),
    ).not.toContain("reviews");
    const home = card({ links: { google }, attributes: { addressHidden: true } });
    expect(home.actions.map((a) => a.key)).not.toContain("reviews");
  });
  it("links photos and the logo from the media bucket", () => {
    const key = "pending/0b3c6b1e-6f0e-4d36-9b0e-2f7f8c1d2a10.webp";
    const c = card({ logo: { key }, photos: [{ key, alt: { en: "The bar" } }] });
    expect(c.logoUrl).toBe(`https://media.darb.co.il/${key}`);
    expect(c.photos).toEqual([{ src: `https://media.darb.co.il/${key}`, alt: "The bar" }]);
  });
});

describe("cardFromDraft", () => {
  it("reads the form's links as the API will store them", () => {
    const c = cardFromDraft("en", copy.en, {
      name: "Abu Samir",
      kindName: null,
      townName: "Sakhnin",
      address: " ",
      accent: "#5fb3a8",
      icons: "line",
      logoUrl: null,
      photoUrls: [],
      phone: "04-674-1234",
      whatsapp: "050-123-4567",
      point: null,
      website: "abusamir.co.il",
      instagram: "@AbuSamir",
      facebook: "",
      tiktok: "not a handle!",
      hours: { weekly: {}, exceptions: [] },
    });
    expect(c.meta).toBe("Sakhnin");
    expect(c.address).toBeNull();
    expect(c.primary.kind).toBe("whatsapp");
    expect(c.actions.map((a) => [a.key, a.href])).toEqual([
      ["call", "tel:+97246741234"],
      ["website", "https://abusamir.co.il/"],
    ]);
    expect(c.social).toEqual([
      { key: "instagram", label: "Instagram", href: "https://www.instagram.com/abusamir/" },
    ]);
  });
});
