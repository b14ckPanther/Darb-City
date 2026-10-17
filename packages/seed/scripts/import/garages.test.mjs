import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildGarages, nameWords } from "./garages.mjs";

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
