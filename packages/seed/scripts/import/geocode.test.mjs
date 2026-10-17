import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  createGeocoder,
  houseNumber,
  looseStreetKey,
  parseAddress,
  streetKey,
  tiles,
} from "./geocode.mjs";
import { createPlaceMatcher } from "./places.mjs";

const fixture = JSON.parse(
  readFileSync(new URL("./fixtures/geocode.json", import.meta.url), "utf8"),
);
const geocoder = createGeocoder(fixture, createPlaceMatcher(fixture.places));
const at = (town, address) => geocoder.resolve({ town, address });

describe("street names and numbers", () => {
  it("drops street prefixes, quotes and dashes", () => {
    expect(streetKey("רח' יהודה הלוי")).toBe(streetKey("יהודה הלוי"));
    expect(streetKey("רחוב העוצמה")).toBe(streetKey("העוצמה"));
    expect(streetKey("שד' ההסתדרות")).toBe(streetKey("שדרות ההסתדרות"));
    expect(streetKey("בן-גוריון")).toBe(streetKey("בן גוריון"));
    expect(streetKey("דרך י. סימון")).toBe(streetKey("י סימון"));
    expect(streetKey("קרן היסוד")).toBe(streetKey("כרן היסוד"));
    expect(streetKey("צה ל")).toBe(streetKey('צה"ל'));
  });
  it("meets spelling variants loosely: vav, yod, the article", () => {
    expect(streetKey("הלוי")).toBe(streetKey("הלווי"));
    expect(streetKey("חיים")).toBe(streetKey("חייים"));
    expect(looseStreetKey("השיש")).toBe(looseStreetKey("שיש"));
    expect(looseStreetKey("פרידלנדר")).toBe(looseStreetKey("פרדלנדר"));
  });
  it("reads house numbers", () => {
    expect(houseNumber("12א")).toBe(12);
    expect(houseNumber("12-14")).toBe(12);
    expect(houseNumber("6/ב")).toBe(6);
    expect(houseNumber("")).toBeNull();
  });
  it("parses the register's addresses", () => {
    expect(parseAddress("ת.ד 10451 השיש 18")).toMatchObject({ street: "השיש", number: 18 });
    expect(parseAddress("רח' העוצמה 11 ת.ד' 164 א.תעשייה טירת כרמל", "טירת כרמל")).toMatchObject({
      street: "רח' העוצמה",
      number: 11,
      industrial: true,
    });
    expect(parseAddress("ת.ד.524 ת.ד.סונול")).toMatchObject({ street: null, number: null });
    expect(parseAddress("אזור תעשיה ירכא תד' 784", "ירכא")).toMatchObject({
      street: null,
      industrial: true,
    });
    expect(parseAddress("ת.ד.3400 א.ת.דרומי")).toMatchObject({ areaName: "דרומי" });
    expect(parseAddress("ת.ד.96 עיבלין - צומת שפרעם").junction).toBe("שפרעם");
    expect(parseAddress("ד.נ.גליל תחתון").street).toBeNull();
    expect(parseAddress("גוש 18530 חלקה 31 ת.ד 425").street).toBeNull();
    expect(parseAddress("רח' היוצרים25").number).toBe(25);
    expect(parseAddress("שדרות אבא חושי").street).toBe("שדרות אבא חושי");
  });
});

describe("resolving an address", () => {
  it("pins an exact house number", () => {
    expect(at("haifa", "רח' השיש 18")).toMatchObject({
      precision: "exact",
      lat: 32.8008,
      lng: 35,
    });
  });
  it("interpolates between numbers on the same side within 200 m", () => {
    const hit = at("haifa", "השיש 14");
    expect(hit.precision).toBe("near");
    expect(hit.lat).toBeCloseTo(32.8004, 4);
  });
  it("finds a number OSM gives no city to near the town", () => {
    expect(at("haifa", "יהודה הלוי 8")).toMatchObject({ precision: "exact", lng: 35.01 });
  });
  it("pins a short street's midpoint, never a long one's", () => {
    expect(at("haifa", "רח' המלאכה 40")).toMatchObject({ precision: "street", lat: 32.806 });
    expect(at("haifa", "דרך ארוכה 3").skip).toMatch(/longer than 700/);
  });
  it("meets a street written by surname only, words reversed or mistyped", () => {
    expect(at("haifa", "רחוב מייזר 8 א.תעשיה")).toMatchObject({ precision: "exact", lat: 32.82 });
    expect(at("haifa", "עמרם אברהם 10")).toMatchObject({ precision: "exact", lat: 32.826 });
    expect(at("haifa", "פרילנדר 12 ת ד 5676")).toMatchObject({ precision: "exact", lat: 32.825 });
    expect(at("haifa", "א.תעשייה ישן פרידלנדר 12").precision).toBe("exact");
  });
  it("skips a number that stands in two places", () => {
    expect(at("haifa", "הרצל 3").skip).toBeDefined();
  });
  it("uses the town's addr:city, not its nearest centre", () => {
    expect(at("nesher", "דרך השלום 5").precision).toBe("exact");
    expect(at("haifa", "דרך השלום 5").skip).toBeDefined();
  });
  it("pins a small named industrial zone or junction, never a large one", () => {
    expect(at("yirka", "אזור תעשיה ירכא תד' 784")).toMatchObject({ precision: "area", lat: 32.96 });
    expect(at("yirka", "ת.ד 5 צומת ירכא")).toMatchObject({ precision: "area", lng: 35.22 });
    expect(at("haifa", "א.ת. דרומי").skip).toMatch(/larger than/);
  });
  it("never pins a PO box or a town centre", () => {
    expect(at("haifa", "ת.ד. 2318").skip).toMatch(/PO box/);
    expect(at("haifa", "").skip).toMatch(/no address/);
    expect(at("haifa", "רח' לא קיים 3").skip).toMatch(/not on the map/);
  });
});

describe("tiles", () => {
  it("covers the north in quarter-degree tiles", () => {
    const t = tiles("32.3,34.85,33.35,35.9");
    expect(t[0]).toEqual([32.3, 34.85, 32.55, 35.1]);
    expect(t.at(-1)).toEqual([33.3, 35.85, 33.35, 35.9]);
    expect(t).toHaveLength(25);
  });
});
