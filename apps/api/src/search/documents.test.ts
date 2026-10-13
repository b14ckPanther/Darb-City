import { describe, expect, it } from "vitest";
import { businessDocument, completeness, kindDocument, placeDocument } from "./documents.js";

const hours = { weekly: { 0: [{ open: "09:00", close: "17:00" }] }, exceptions: [] };
const business = {
  id: "b1",
  slug: "hummus-al-balad",
  tier: "example" as const,
  lat: 32.86,
  lng: 35.3,
  name: { he: "חומוס אל בלד", ar: "حمص البلد", en: "Hummus Al Balad" },
  tagline: { en: "2 more plates and the next is on us" },
  address: { en: "Sakhnin" },
  phone: null,
  whatsapp: null,
  website: null,
  photos: [],
  hours,
  attributes: { delivers: true },
  experience: { items: [{ label: { en: "Hummus" } }] },
  placePath: "/israel/northern-district/sakhnin/",
  placeName: { he: "סח'נין", ar: "سخنين", en: "Sakhnin" },
  kinds: [
    {
      id: "k1",
      name: { en: "Hummus and falafel" },
      synonyms: { he: ["חומוס"], ar: ["حمص"], en: ["falafel"] },
    },
  ],
};

describe("documents", () => {
  it("normalizes names, tagline, kinds and place into the business text", () => {
    const doc = businessDocument(business);
    expect(doc).toMatchObject({
      entityType: "business",
      entityId: "b1",
      slug: "hummus-al-balad",
      kindIds: ["k1"],
      placePath: "/israel/northern-district/sakhnin/",
      tier: "example",
      attributes: { delivers: true },
    });
    expect(doc.nameText).toBe("חומוס אל בלד حمص البلد hummus al balad");
    for (const word of ["falafel", "חומוס", "sakhnin", "سخنين", "plates"])
      expect(doc.text).toContain(word);
    expect(doc.embedText).toContain("Hummus Al Balad");
    expect(doc.embedText).toContain("Hummus and falafel");
  });
  it("scores completeness over seven facts", () => {
    expect(completeness(business)).toBeCloseTo(4 / 7, 5); // tagline, address, hours, experience
    expect(
      completeness({
        ...business,
        tagline: {},
        address: {},
        hours: { weekly: {}, exceptions: [] },
        experience: {},
      }),
    ).toBe(0);
    expect(
      completeness({ ...business, phone: "1", website: "https://x", photos: [{ key: "a" }] }),
    ).toBe(1);
  });
  it("builds place and kind documents", () => {
    const place = placeDocument({
      id: "p1",
      slug: "sakhnin",
      path: "/israel/northern-district/sakhnin/",
      name: { en: "Sakhnin" },
      aliases: ["SAKHNIN"],
      lat: 1,
      lng: 2,
    });
    expect(place).toMatchObject({
      entityType: "place",
      placePath: "/israel/northern-district/sakhnin/",
      text: "sakhnin",
    });
    const kind = kindDocument({
      id: "k1",
      slug: "hummus",
      name: { en: "Hummus and falafel" },
      synonyms: { he: [], ar: [], en: ["falafel"] },
    });
    expect(kind).toMatchObject({
      entityType: "kind",
      placePath: "",
      kindIds: ["k1"],
      text: "hummus and falafel falafel",
    });
  });
});
