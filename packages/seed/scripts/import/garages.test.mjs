import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildGarages, nameWords } from "./garages.mjs";
import { createGeocoder } from "./geocode.mjs";
import { createPlaceMatcher } from "./places.mjs";

const fixture = JSON.parse(
  readFileSync(new URL("./fixtures/garages.json", import.meta.url), "utf8"),
);

describe("garages importer over a fixture", () => {
  const { businesses, counts } = buildGarages(fixture);
  const by = (id) => businesses.find((b) => b.attributes.motGarageId === id);

  it("lists only garages OSM places in their own town, by name or phone", () => {
    expect(counts).toMatchObject({
      fetched: 5,
      outsideNorth: 1,
      inNorth: 4,
      matchedByName: 2,
      matchedByPhone: 1,
      noConfidentPoint: 1,
      emitted: 3,
    });
    expect(by(3)).toBeUndefined(); // no OSM twin: skipped, never pinned at the town centre
  });
  it("merges a garage's specialty rows and maps them to kinds and items", () => {
    const almog = by(1);
    expect(almog).toMatchObject({
      place: "karmiel",
      kinds: ["garages", "tyres"],
      phone: "+972 4-988-1234",
      lat: 32.918,
      lng: 35.295,
      tier: "basic",
    });
    expect(almog.experience.items.map((i) => i.label.en)).toEqual(["Petrol engines", "Tyres"]);
    expect(by(5).kinds).toEqual(["garages", "body-shops"]);
  });
  it("makes a testing station a vehicle-testing listing", () => {
    const chen = by(2);
    expect(chen.place).toBe("pardes-hana-karkur");
    expect(chen.primaryKind).toBe("vehicle-testing");
    expect(chen.experience.items[0].label.en).toBe("Annual vehicle test");
    expect(chen.name.he).not.toMatch(/בע מ/);
  });
  it("never matches on generic words or a town's name", () => {
    expect(nameWords("מוסך כרמיאל")).toEqual([expect.any(String)]);
    expect(nameWords("מוסך שירותי רכב")).toEqual([]);
  });
});

describe("garages importer with the address geocoder", () => {
  const geo = JSON.parse(
    readFileSync(new URL("./fixtures/garages-geo.json", import.meta.url), "utf8"),
  );
  const matcher = createPlaceMatcher();
  const geocoder = createGeocoder(geo, matcher);
  const { businesses, counts, coverage, skipped } = buildGarages({ ...geo, geocoder, matcher });
  const by = (id) => businesses.find((b) => b.attributes.motGarageId === id);

  it("pins testing stations by address and says how precisely", () => {
    expect(by(102)).toMatchObject({
      place: "haifa",
      primaryKind: "vehicle-testing",
      lat: 32.8065,
      attributes: { geoPrecision: "exact", sourceAddress: "רח אדיסון 11", motGarageIds: "102,106" },
    });
    expect(by(101)).toMatchObject({ place: "yirka", attributes: { geoPrecision: "area" } });
  });
  it("groups a garage's trade rows and maps trades to kinds and items", () => {
    const g = by(103);
    expect(g.attributes.geoPrecision).toBe("near");
    expect(g.lat).toBeCloseTo(32.807, 4);
    expect(g.kinds).toEqual(["garages", "body-shops"]);
    expect(g.experience.items.map((i) => i.label.en)).toEqual(["Auto electric", "Body work"]);
    expect(g.name.ar).toContain("كراج");
    expect(g.name.en).toMatch(/Garage$/);
  });
  it("counts and explains every northern record it could not pin", () => {
    expect(counts).toMatchObject({ inNorth: 6, outsideNorth: 1, exact: 1, near: 1, area: 1 });
    expect(coverage.testing).toMatchObject({ inNorth: 3, exact: 1, area: 1, skipped: 1 });
    expect(coverage.garage).toMatchObject({ inNorth: 2, near: 1, merged: 1 });
    expect(coverage.agricultural).toMatchObject({ inNorth: 1, skipped: 1 });
    const why = Object.fromEntries(skipped.map((s) => [s.id, s.why]));
    expect(why[104]).toMatch(/industrial zone/);
    expect(why[105]).toMatch(/PO box/);
  });
  it("writes no legal suffix, maqaf or long dash", () => {
    for (const b of businesses)
      for (const t of [...Object.values(b.name), ...Object.values(b.tagline)])
        expect(t).not.toMatch(/בע מ|בע"מ|[־–—]/);
  });
});
