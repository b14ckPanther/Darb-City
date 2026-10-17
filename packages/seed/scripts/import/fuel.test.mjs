import { readFileSync } from "node:fs";
import { Ajv } from "ajv";
import { describe, expect, it } from "vitest";
import { SCREEN_SCHEMA } from "../../src/screen-schema.ts";
import { buildFuel, chainOf } from "./fuel.mjs";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/fuel.json", import.meta.url), "utf8"));

describe("fuel importer over a fixture", () => {
  const { businesses, counts } = buildFuel(fixture);
  const sonol = businesses.find((b) => b.brand === "sonol");

  it("skips Paz and stations outside the north, and keeps the rest", () => {
    expect(counts).toMatchObject({ fetched: 4, paz: 1, outsideNorth: 1, emitted: 2 });
    expect(businesses.map((b) => b.place).sort()).toEqual(["karmiel", "kaukab-abu-al-hija"]);
  });
  it("gives a chain station its brand, phone, site, accent and official id", () => {
    expect(sonol).toMatchObject({
      place: "karmiel",
      primaryKind: "stations",
      tier: "basic",
      phone: expect.stringMatching(/^\+972 \d{1,2}-\d{3}-\d{4}$/),
      website: "https://www.sonol.co.il",
      cardStyle: { accent: "#6fa8dc", icons: "solid" },
      attributes: { primaryAction: "directions", fuelAdminNo: 1366 },
    });
    expect(sonol.name.en).toMatch(/^Sonol /);
    expect(sonol.name.ar).toMatch(/^سونول /);
    expect(sonol.slug).toMatch(/^sonol-/);
  });
  it("reads 24/7, grades, a car wash and EV chargers from OSM and the ministry", () => {
    expect(sonol.kinds).toEqual(["stations", "car-wash", "ev-charging"]);
    expect(sonol.hours.weekly["0"]).toEqual([{ open: "00:00", close: "24:00" }]);
    const items = Object.fromEntries(sonol.experience.items.map((i) => [i.label.en, i.meta?.en]));
    expect(items).toEqual({
      Fuel: "95 · Diesel",
      "Car wash": undefined,
      "EV charging": "2 fast · 1 standard",
      "Open 24/7": undefined,
    });
    // The shop 1 km away is not the station's.
    expect(items["Convenience store"]).toBeUndefined();
  });
  it("leaves hours empty without a source, and names an independent station by its town", () => {
    const other = businesses.find((b) => b.brand === null);
    expect(other.hours).toEqual({ weekly: {}, exceptions: [] });
    expect(other.website).toBeNull();
    expect(other.name.he).not.toMatch(/בע"מ/);
  });
  it("writes valid screens with no long dashes", () => {
    const validate = new Ajv({ allErrors: true }).compile(SCREEN_SCHEMA);
    for (const b of businesses) {
      expect(validate(b.experience), JSON.stringify(validate.errors)).toBe(true);
      expect(JSON.stringify(b)).not.toMatch(/[־–—]/);
    }
  });
  it("maps company spellings to one chain", () => {
    expect(chainOf("דור-אלון")?.slug).toBe("dor-alon");
    expect(chainOf("דור אלון")?.slug).toBe("dor-alon");
    expect(chainOf("אחר \\ עצמאי")).toBeNull();
  });
});
