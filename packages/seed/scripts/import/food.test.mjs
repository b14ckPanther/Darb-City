import { readFileSync } from "node:fs";
import { Ajv } from "ajv";
import { describe, expect, it } from "vitest";
import { SCREEN_SCHEMA } from "../../src/screen-schema.ts";
import { buildFood, FILE } from "./food.mjs";
import { exclusion } from "./food-kinds.mjs";
import { parseOpeningHours } from "./opening-hours.mjs";

const json = (url) => JSON.parse(readFileSync(url, "utf8"));
const fixture = json(new URL("./fixtures/food.json", import.meta.url));
const data = (file) => json(new URL(`../../data/${file}`, import.meta.url));
const validate = new Ajv({ allErrors: true }).compile(SCREEN_SCHEMA);
const NEVER = /(?<!\p{L})(pork|bacon|casino|lotto|חזיר|פאב|קזינו|خنزير|كازينو)(?!\p{L})/iu;

describe("food importer over a fixture", () => {
  const { businesses, counts } = buildFood(fixture);
  const by = (en) => businesses.find((b) => b.name.en === en);

  it("never emits bars, pubs, pork, alcohol, lottery, wineries or nightclubs", () => {
    expect(counts.excluded).toEqual({
      bar: 2,
      pork: 2,
      gambling: 1,
      winery: 1,
      alcohol: 2,
      nightclub: 1,
    });
    for (const id of [20, 21, 22, 23, 24, 25, 26, 27, 28])
      expect(
        businesses.some((b) => b.attributes.osmId === `node/${id}`),
        String(id),
      ).toBe(false);
  });
  it("skips unnamed places, places outside the north and what Darb already lists", () => {
    expect(counts).toMatchObject({ unnamed: 1, outsideNorth: 1, alreadyListed: 1, duplicates: 2 });
    expect(businesses.some((b) => b.name.en === "Caramel")).toBe(false);
  });
  it("makes one card of two points with one name 50 m apart, keeping the richer", () => {
    const shawarma = businesses.filter((b) => b.name.he === "שווארמה אבו סאלח");
    expect(shawarma).toHaveLength(1);
    expect(shawarma[0].attributes.osmId).toBe("node/1");
    // One name 25 m apart is one place even as a restaurant and a café.
    const havana = businesses.filter((b) => b.name.en === "Havana");
    expect(havana).toHaveLength(1);
    expect(havana[0].phone).toBe("+972 4-850-1234");
  });
  it("gives a shawarma place its kinds, dishes, phone, hours, links and services", () => {
    const b = businesses.find((x) => x.attributes.osmId === "node/1");
    expect(b).toMatchObject({
      place: "sakhnin",
      primaryKind: "grill",
      kinds: ["grill", "hummus"],
      tier: "basic",
      phone: "+972 4-674-1234",
      attributes: { primaryAction: "directions", delivers: true, takeaway: true },
      links: { instagram: "https://www.instagram.com/abusaleh_shawarma/" },
      cardStyle: { accent: "#d9a54c", icons: "solid" },
    });
    expect(b.name).toEqual({
      he: "שווארמה אבו סאלח",
      ar: "شاورما أبو صالح",
      en: expect.stringMatching(/^Shawarma Abu/),
    });
    expect(b.experience.items.map((i) => i.label.he)).toEqual(["שווארמה", "פלאפל"]);
    expect(b.experience.tags.map((t) => t.en)).toEqual(["Delivery", "Takeaway"]);
    expect(b.experience.cta).toEqual({ he: "ניווט", ar: "خذني لهناك", en: "Directions" });
    expect(b.hours.weekly["5"]).toEqual([{ open: "13:00", close: "23:00" }]);
    expect(b.hours.weekly["6"]).toEqual([{ open: "10:00", close: "23:00" }]);
    expect(b.tagline).toEqual({
      he: "שווארמה וגריל, פלאפל",
      ar: "شاورما ومشاوي، فلافل",
      en: "Shawarma and grill, falafel",
    });
  });
  it("gives a café its website, Facebook page, vegan options and a Hebrew name", () => {
    const b = by("Café Masada");
    expect(b).toMatchObject({
      place: "haifa",
      primaryKind: "cafes",
      website: "https://cafemasada.co.il/",
      links: { facebook: expect.stringContaining("facebook.com/cafemasada") },
      attributes: { outdoorSeating: true, wheelchair: true, vegan: true },
    });
    expect(b.name.he).toBe("קפה מסדה");
    expect(b.experience.tags.map((t) => t.en)).toEqual([
      "Outdoor seating",
      "Wheelchair accessible",
      "Vegan options",
    ]);
    expect(b.hours.weekly["5"]).toEqual([{ open: "07:00", close: "15:00" }]);
  });
  it("names an Arabic-only place in Hebrew and English letters", () => {
    const b = businesses.find((x) => x.attributes.osmId === "node/4");
    expect(b).toMatchObject({ place: "nazareth", primaryKind: "hummus" });
    expect(b.name.ar).toBe("فلافل وحمص الشرق");
    expect(b.name.he).toMatch(/^פלאפל/);
    expect(b.name.en).toMatch(/^Falafel/);
    expect(b.hours).toEqual({ weekly: {}, exceptions: [] });
  });
  it("says gluten-free only for a fully gluten-free kitchen", () => {
    const only = businesses.find((x) => x.attributes.osmId === "node/5");
    const some = businesses.find((x) => x.attributes.osmId === "node/6");
    expect(only.dietary).toEqual(["gluten_free"]);
    expect(only.experience.tags.map((t) => t.en)).toContain("Gluten-free");
    expect(some.dietary).toBeUndefined();
    expect(JSON.stringify(some.experience)).not.toMatch(/gluten/i);
  });
  it("lists knafeh and baklava as sweets, and a juice bar as juice", () => {
    const sweets = businesses.find((x) => x.attributes.osmId === "node/7");
    expect(sweets.kinds[0]).toBe("sweets");
    expect(sweets.experience.items.map((i) => i.label.en)).toEqual(
      expect.arrayContaining(["Knafeh", "Baklava"]),
    );
    expect(businesses.find((x) => x.attributes.osmId === "node/32").kinds[0]).toBe("juice-shops");
  });
  it("writes valid screens, unique slugs and no long dashes", () => {
    for (const b of businesses) {
      expect(validate(b.experience), JSON.stringify(validate.errors)).toBe(true);
      expect(JSON.stringify(b)).not.toMatch(/[־–—]/);
    }
    const keys = businesses.map((b) => `${b.place}/${b.slug}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe(`the published ${FILE}`, () => {
  const { source, businesses } = data(`listings/${FILE}`);
  const kinds = new Map(data("kinds.json").map((k) => [k.slug, k]));
  const places = new Map(data("places.json").map((p) => [p.slug, p]));
  const brands = new Set(data("brands.json").map((b) => b.slug));
  const NORTH = new Set(["northern-district", "haifa-district"]);
  const districtOf = (slug) => {
    for (let p = places.get(slug); p; p = places.get(p.parent))
      if (p.type === "region") return p.slug;
    return null;
  };

  it("credits OpenStreetMap", () => {
    expect(source.attribution).toMatch(/OpenStreetMap contributors/);
    expect(source.licence).toMatch(/ODbL/);
  });
  it("has only active food kinds, live northern places and known brands", () => {
    expect(businesses.length).toBeGreaterThan(1000);
    for (const b of businesses) {
      const where = `${b.place}/${b.slug}`;
      expect(b.kinds, where).toContain(b.primaryKind);
      for (const k of b.kinds) {
        expect(kinds.get(k)?.sector, `${where} ${k}`).toBe("food");
        expect(kinds.get(k)?.status).toBe("active");
      }
      expect(places.get(b.place)?.status, where).toBe("live");
      expect(NORTH.has(districtOf(b.place)), where).toBe(true);
      if (b.brand) expect(brands.has(b.brand), b.brand).toBe(true);
      expect(b.tier).toBe("basic");
    }
  });
  it("has names, taglines and addresses in three languages and valid screens", () => {
    for (const b of businesses) {
      for (const field of [b.name, b.tagline, b.address])
        for (const l of ["he", "ar", "en"]) expect(field[l]?.trim(), `${b.slug} ${l}`).toBeTruthy();
      expect(validate(b.experience), b.slug).toBe(true);
      if (b.phone) expect(b.phone).toMatch(/^\+972 \d{1,2}-\d{3}-\d{4}$/);
      for (const url of [b.website, ...Object.values(b.links ?? {})].filter(Boolean))
        expect(url).toMatch(/^https:\/\//);
    }
  });
  it("never names a bar, pork, alcohol or gambling, and has no long dashes", () => {
    for (const b of businesses) {
      const text = JSON.stringify([b.name, b.tagline, b.experience]);
      expect(text, b.slug).not.toMatch(NEVER);
      const tags = {
        amenity: "restaurant",
        name: b.name.he,
        "name:ar": b.name.ar,
        "name:en": b.name.en,
        description: JSON.stringify([b.tagline, b.experience.items]),
      };
      expect(exclusion(tags), b.slug).toBeNull();
      expect(text).not.toMatch(/[־–—]/);
    }
  });
  it("has hours only where OSM's hours read cleanly", () => {
    for (const b of businesses) {
      for (const day of Object.values(b.hours.weekly))
        for (const i of day) {
          expect(i.open).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
          expect(i.close).toMatch(/^([01]\d|2[0-4]):[0-5]\d$/);
        }
    }
    expect(parseOpeningHours("24/7")).not.toBeNull();
  });
});
