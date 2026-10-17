import { describe, expect, it } from "vitest";
import { createPlaceMatcher, loose, normalize } from "./places.mjs";

const m = createPlaceMatcher();

describe("normalize", () => {
  it("meets קרית and קריית, final letters and doubled letters", () => {
    expect(normalize("קריית ביאליק")).toBe(normalize("קרית ביאליק"));
    expect(normalize("ג'ש")).toBe(normalize("ג׳ש"));
    expect(normalize("בנימינה-גבעת עדה")).toBe(normalize("בנימינה גבעת עדה"));
    expect(loose("ג'יש")).toBe(loose("ג'ש"));
    expect(loose("עוספיה")).toBe(loose("עספיא"));
  });
});

describe("place matching", () => {
  const slug = (q) => m.match(q)?.place.slug;
  it("matches town names however they are spelled", () => {
    expect(slug({ town: "קריית מוצקין" })).toBe("kiryat-motzkin");
    expect(slug({ town: "קרית מוצקין" })).toBe("kiryat-motzkin");
    expect(slug({ town: "כורדני" })).toBe("kiryat-motzkin");
    expect(slug({ town: "פקיעין" })).toBe("peqiin");
    expect(slug({ town: "ג'ש" })).toBe("jish-gush-halav");
    expect(slug({ town: "ג'יש" })).toBe("jish-gush-halav");
    expect(slug({ town: "גוש חלב" })).toBe("jish-gush-halav");
    expect(slug({ town: "קיבוץ יפעת" })).toBe("ifat");
    expect(slug({ town: "HAIFA" })).toBe("haifa");
  });
  it("trusts a name only near the point, and picks the nearer of two same-named places", () => {
    // Tamra: the Galilee city (טמרה) against the Jezreel village (תמרה), from the city's point.
    const r = m.match({ town: "תמרה", lat: 32.8536, lng: 35.1978 });
    expect(r.place.slug).toBe("tamra");
    expect(r.how).toBe("name");
  });
  it("falls back to the nearest settlement within 6 km, recording the distance", () => {
    const r = m.match({ town: "מ.א עמק הירדן", lat: 32.7046, lng: 35.5825 });
    expect(r.how).toBe("nearest");
    expect(r.km).toBeLessThanOrEqual(6);
    expect(m.match({ town: "שום מקום", lat: 33.6, lng: 36.5 })).toBeNull();
  });
  it("knows which places are in the north", () => {
    expect(m.inNorth("haifa")).toBe(true);
    expect(m.inNorth("kiryat-haim")).toBe(true);
    expect(m.inNorth("nazareth")).toBe(true);
    expect(m.inNorth("tel-aviv-yafo")).toBe(false);
  });
});
