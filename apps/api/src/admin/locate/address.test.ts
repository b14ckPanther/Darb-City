import { describe, expect, it } from "vitest";
import { houseNumbers, parseAddress, sameStreet, streetKey, streetVariants } from "./address.js";

describe("parseAddress", () => {
  it.each([
    ["שדרות המגינים 68 חיפה", "שדרות המגינים", "68", "חיפה"],
    ["שדרות המגינים 68, חיפה", "שדרות המגינים", "68", "חיפה"],
    ["עין דור 11", "עין דור", "11", null],
    ["רח' הרצל 5, נצרת", "רח' הרצל", "5", "נצרת"],
    ["רח׳ הרצל 12א", "רח' הרצל", "12א", null],
    ['ש"ד המגינים 68 חיפה', 'ש"ד המגינים', "68", "חיפה"],
    ["שד׳ בן גוריון 3, חיפה, ישראל", "שד' בן גוריון", "3", "חיפה"],
    ["شارع الجبل 5 الناصرة", "شارع الجبل", "5", "الناصرة"],
    ["شارع الجبل 5، الناصرة", "شارع الجبل", "5", "الناصرة"],
    ["68 Hameginim Blvd, Haifa", "Hameginim Blvd", "68", "Haifa"],
    ["Herzl St 12, Nazareth", "Herzl St", "12", "Nazareth"],
    ["עין דור, חיפה", "עין דור", null, "חיפה"],
    ["החרושת 12-14 כרמיאל", "החרושת", "12", "כרמיאל"],
  ])("%s", (raw, street, number, town) => {
    const p = parseAddress(raw);
    expect(p).not.toBeNull();
    expect(p!.street).toBe(street);
    expect(p!.number).toBe(number);
    expect(p!.town).toBe(town);
  });

  it("drops the country and the postcode", () => {
    expect(parseAddress("עין דור 11, חיפה, 3341231, ישראל")).toMatchObject({
      street: "עין דור",
      number: "11",
      town: "חיפה",
    });
  });

  it("keeps the number's digits apart from its letter", () => {
    expect(parseAddress("הרצל 12א")).toMatchObject({ number: "12א", numeric: 12 });
  });

  it("refuses what is no address", () => {
    expect(parseAddress("")).toBeNull();
    expect(parseAddress("   ,  ")).toBeNull();
    expect(parseAddress("12345")).toBeNull();
    expect(parseAddress("הרצל 99999")).toMatchObject({ number: null });
  });
});

describe("streetVariants", () => {
  it("writes the boulevard out, and tries without the street word", () => {
    expect(streetVariants("שד' המגינים")[0]).toBe("שדרות המגינים");
    expect(streetVariants('ש"ד המגינים')[0]).toBe("שדרות המגינים");
    expect(streetVariants("רח' הרצל")[0]).toBe("הרצל");
    expect(streetVariants("شارع الجبل")).toEqual(["شارع الجبل", "الجبل"]);
    expect(streetVariants("עין דור")).toEqual(["עין דור"]);
  });
});

describe("streetKey", () => {
  it("lets OpenStreetMap's spelling and the admin's meet", () => {
    expect(streetKey("שדרות המגינים")).toBe(streetKey("שד' המגינים"));
    expect(streetKey("רחוב הרצל")).toBe(streetKey("הרצל"));
    expect(streetKey("شارع الجبل")).toBe(streetKey("الجبل"));
    expect(streetKey("Herzl Street")).toBe(streetKey("herzl"));
    expect(streetKey("דרך הים")).toBe("דרכ הימ");
    expect(sameStreet("השיש", "שיש")).toBe(true);
    expect(sameStreet("المدرسة", "مدرسة")).toBe(true);
    expect(sameStreet("הרצל", "ביאליק")).toBe(false);
  });
});

describe("houseNumbers", () => {
  it("reads every number OpenStreetMap packs into one tag", () => {
    expect(houseNumbers("113,115,117")).toEqual([
      { n: 113, suffix: "" },
      { n: 115, suffix: "" },
      { n: 117, suffix: "" },
    ]);
    expect(houseNumbers("12-14")).toEqual([
      { n: 12, suffix: "" },
      { n: 14, suffix: "" },
    ]);
    expect(houseNumbers("12א")).toEqual([{ n: 12, suffix: "א" }]);
    expect(houseNumbers("12/3")).toEqual([{ n: 12, suffix: "" }]);
    expect(houseNumbers("no")).toEqual([]);
  });
});
