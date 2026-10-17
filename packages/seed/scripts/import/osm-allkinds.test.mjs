import { readFileSync } from "node:fs";
import { CARD_ACCENTS } from "@darb/core";
import { Ajv } from "ajv";
import { describe, expect, it } from "vitest";
import { SCREEN_SCHEMA } from "../../src/screen-schema.ts";
import { itmToWgs84 } from "./itm.mjs";
import { buildAllKinds, namesFor } from "./osm-allkinds.mjs";
import { createNamer } from "./names.mjs";

const read = (f) => JSON.parse(readFileSync(new URL(`../../data/${f}`, import.meta.url), "utf8"));
const kinds = read("kinds.json");
const sectors = read("sectors.json").filter((s) => s.slug !== "food");

const KARMIEL = { lat: 32.9172, lon: 35.2958 };
const NAZARETH = { lat: 32.7036, lon: 35.2972 };
let id = 1;
const node = (at, tags, dLat = 0, dLon = 0) => ({
  type: "node",
  id: id++,
  lat: at.lat + dLat,
  lon: at.lon + dLon,
  tags,
});
const way = (at, tags, dLat = 0, dLon = 0) => ({
  type: "way",
  id: id++,
  center: { lat: at.lat + dLat, lon: at.lon + dLon },
  tags,
});

const elements = [
  node(KARMIEL, {
    amenity: "pharmacy",
    name: "סופר-פארם כרמיאל",
    brand: "Super-Pharm",
    "brand:wikidata": "Q7643008",
    opening_hours: "Su-Th 08:00-21:00; Fr 08:00-14:00",
    phone: "04-9988776",
    dispensing: "yes",
    wheelchair: "yes",
  }),
  // The same pharmacy mapped again as its building, 30 m away: one card.
  way(KARMIEL, { amenity: "pharmacy", name: "סופר-פארם כרמיאל" }, 0.0002, 0.0001),
  node(
    KARMIEL,
    {
      shop: "hairdresser",
      name: "מספרת יוסי לגברים",
      "addr:street": "הנשיא",
      "addr:housenumber": "5",
    },
    0.003,
  ),
  node(
    NAZARETH,
    { shop: "clothes", name: "عبايات ليلى", "contact:instagram": "layla_abayas" },
    0.002,
  ),
  node(NAZARETH, { amenity: "place_of_worship", religion: "muslim", name: "مسجد السلام" }, -0.002),
  node(
    NAZARETH,
    { shop: "supermarket", name: "רמי לוי נצרת", website: "www.rami-levy.co.il" },
    0.004,
  ),
  node(KARMIEL, { office: "lawyer", name: "עו\"ד כהן ושות'", phone: "+972-52-1234567" }, -0.003),
  node(KARMIEL, { tourism: "hotel", name: "מלון הגליל", stars: "4" }, 0.006),
  // Never listed.
  node(KARMIEL, { amenity: "bar", name: "The Pub" }, 0.007),
  node(KARMIEL, { shop: "alcohol", name: "Liquor Store" }, 0.008),
  node(KARMIEL, { shop: "convenience", name: "Lotto Point" }, 0.009),
  node(KARMIEL, { shop: "e-cigarette", name: "Vape Galil" }, 0.01),
  node(KARMIEL, { shop: "erotic", name: "X" }, 0.011),
  node(KARMIEL, { shop: "butcher", name: "Pork King" }, 0.012),
  node(KARMIEL, { amenity: "casino", name: "Casino" }, 0.013),
  // Not this importer's: food, garages, schools; no name; outside the north.
  node(KARMIEL, { amenity: "restaurant", name: "מסעדת הגליל" }, 0.014),
  node(KARMIEL, { shop: "car_repair", name: "מוסך" }, 0.015),
  node(KARMIEL, { amenity: "school", name: "בית ספר אורט" }, 0.016),
  node(KARMIEL, { shop: "florist" }, 0.017),
  node({ lat: 32.08, lon: 34.78 }, { shop: "florist", name: "פרחי תל אביב" }),
  // Already listed by another importer (a fuel station's car wash).
  node(NAZARETH, { amenity: "car_wash", name: "שטיפת רכב סונול נצרת" }, 0.006),
];
const existing = [
  {
    slug: "sonol-nazareth",
    place: "nazareth",
    brand: "sonol",
    primaryKind: "stations",
    kinds: ["stations", "car-wash"],
    name: { he: "שטיפת רכב סונול נצרת", ar: "", en: "" },
    lat: NAZARETH.lat + 0.0061,
    lng: NAZARETH.lon,
    attributes: {},
  },
];

describe("all-kinds OSM importer over a fixture", () => {
  const { bySector, counts, excludedWhy } = buildAllKinds({ elements, existing, kinds, sectors });
  const all = Object.values(bySector).flat();
  const byKind = (k) => all.find((b) => b.primaryKind === k);

  it("lists each named business once and says why the rest are out", () => {
    expect(all.map((b) => b.primaryKind).sort()).toEqual([
      "barbershops",
      "hotels",
      "lawyers",
      "modest-fashion",
      "mosques",
      "pharmacies",
      "shops",
    ]);
    expect(counts).toMatchObject({
      excluded: 7,
      noName: 1,
      outsideNorth: 1,
      duplicates: 1,
      alreadyListed: 1,
      emitted: 7,
    });
    expect(counts.unmapped).toBe(3);
    expect(Object.keys(excludedWhy)).toEqual(
      expect.arrayContaining(["bar or nightlife", "alcohol shop", "gambling or lottery", "pork"]),
    );
  });
  it("never emits an excluded business", () => {
    const text = JSON.stringify(all);
    for (const word of ["Pub", "Liquor", "Lotto", "Vape", "Pork", "Casino"])
      expect(text).not.toContain(word);
  });
  it("files each business under its kind's sector", () => {
    expect(bySector.health.map((b) => b.primaryKind)).toEqual(["pharmacies"]);
    expect(bySector.faith.map((b) => b.primaryKind)).toEqual(["mosques"]);
    expect(bySector.retail.map((b) => b.primaryKind).sort()).toEqual(["modest-fashion", "shops"]);
    expect(bySector.food).toBeUndefined();
  });
  it("writes a chain branch with brand, phone, hours and what it offers", () => {
    const p = byKind("pharmacies");
    expect(p).toMatchObject({
      place: "karmiel",
      brand: "super-pharm",
      tier: "basic",
      phone: "+972 4-998-8776",
      attributes: { primaryAction: "directions", wheelchair: true },
    });
    expect(p.attributes.osmId).toMatch(/^node\//);
    expect(p.hours.weekly["0"]).toEqual([{ open: "08:00", close: "21:00" }]);
    expect(p.hours.weekly["6"]).toBeUndefined();
    expect(p.name.en).toBe("Super-Pharm Karmiel");
    expect(p.name.ar).toMatch(/^سوبر فارم /);
    expect(p.tagline).toEqual({
      he: "בית מרקחת בכרמיאל",
      ar: expect.stringMatching(/^صيدلية في /),
      en: "Pharmacy in Karmiel",
    });
    const labels = p.experience.items.map((i) => i.label.en);
    expect(labels).toEqual(["Pharmacy", "Chain", "Prescriptions", "Wheelchair accessible"]);
  });
  it("reads Arabic-only names into Hebrew and English, and keeps social links", () => {
    const a = byKind("modest-fashion");
    expect(a.name.ar).toBe("عبايات ليلى");
    expect(a.name.he).toMatch(/[א-ת]/);
    expect(a.name.en).toMatch(/^[A-Za-z' -]+$/);
    expect(a.links).toEqual({ instagram: "https://www.instagram.com/layla_abayas" });
    const shop = byKind("shops");
    expect(shop.website).toBe("https://www.rami-levy.co.il");
    expect(shop.brand).toBe("rami-levy");
    expect(shop.tagline.en).toBe("Supermarket in Nazareth");
  });
  it("gives an address from the street, and slugs from the English name", () => {
    const barber = byKind("barbershops");
    expect(barber.address.he).toBe("הנשיא 5");
    expect(barber.slug).toMatch(/^[a-z0-9-]+$/);
    expect(byKind("hotels").experience.items.map((i) => i.label.en)).toContain("Stars");
  });
  it("writes valid screens, Darb's card accents and no long dashes", () => {
    const validate = new Ajv({ allErrors: true }).compile(SCREEN_SCHEMA);
    for (const b of all) {
      expect(validate(b.experience), JSON.stringify(validate.errors)).toBe(true);
      expect(CARD_ACCENTS).toContain(b.cardStyle.accent);
      expect(JSON.stringify(b)).not.toMatch(/[־–—]/);
      for (const l of ["he", "ar", "en"]) {
        expect(b.name[l], `${b.slug} name.${l}`).toBeTruthy();
        expect(b.tagline[l]).toBeTruthy();
        expect(b.address[l]).toBeTruthy();
      }
    }
  });
});

describe("names", () => {
  const namer = createNamer();
  it("prefers OSM's own names and fills the missing ones", () => {
    expect(namesFor({ name: "Tech Hub", "name:he": "טק האב" }, namer)).toEqual({
      he: "טק האב",
      ar: expect.any(String),
      en: "Tech Hub",
    });
    expect(namesFor({ name: "KSP" }, namer)).toEqual({ he: "KSP", ar: "KSP", en: "KSP" });
    expect(namesFor({}, namer)).toBeNull();
  });
});

describe("ITM to WGS84", () => {
  it("puts the grid's origin and a Haifa point where they are", () => {
    const o = itmToWgs84(219529.584, 626907.39);
    expect(o.lat).toBeCloseTo(31.7348, 3);
    expect(o.lng).toBeCloseTo(35.2052, 3);
    // Checked against OSM: 50 kindergartens the ministry and OSM both name sit a median 9 m apart.
    const h = itmToWgs84(200131, 748474);
    expect(h.lat).toBeCloseTo(32.8309, 3);
    expect(h.lng).toBeCloseTo(34.998, 3);
  });
});
