import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { chainInName, stationForCharger } from "./ev-match.mjs";
import { buildEv } from "./ev.mjs";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/ev.json", import.meta.url), "utf8"));

describe("EV importer over a fixture", () => {
  const { businesses, counts } = buildEv(fixture);

  it("places ministry chargers only through a same-named OSM station", () => {
    expect(counts).toMatchObject({ fetched: 3, atFuelStation: 1, noOsmMatch: 1, matched: 1 });
    const sara = businesses.find((b) => b.attributes.motChargerIds === "1");
    expect(sara).toMatchObject({ place: "nahariya", brand: "afcon-ev", kinds: ["ev-charging"] });
    expect(sara.experience.items[0]).toMatchObject({ meta: { en: "2 standard" } });
  });
  it("adds OSM stations of a known operator, one card per site, and skips unknown operators", () => {
    const tesla = businesses.filter((b) => b.brand === "tesla");
    expect(tesla).toHaveLength(1);
    expect(tesla[0]).toMatchObject({ place: "afula", slug: "tesla-afula" });
    expect(tesla[0].hours.weekly["3"]).toEqual([{ open: "00:00", close: "24:00" }]);
    expect(businesses).toHaveLength(2);
  });
});

describe("chargers at fuel stations", () => {
  it("know a chain's name in a charger's name", () => {
    expect(chainInName("סונול כרמיאל")).toEqual({ brand: "sonol", rest: "כרמיאל" });
    expect(chainInName("דור-אלון צומת גומא")?.brand).toBe("dor-alon");
    expect(chainInName("מרכז עין שרה")).toBeNull();
  });
  it("match one station of that chain by its name", () => {
    const stations = [
      { brand: "sonol", keys: ["כרמיאל"], ref: "a" },
      { brand: "delek", keys: ["כרמיאל"], ref: "b" },
      { brand: "sonol", keys: ["עכו"], ref: "c" },
      { brand: "sonol", keys: ["עכו"], ref: "d" },
    ];
    expect(stationForCharger("סונול כרמיאל", stations)).toBe("a");
    expect(stationForCharger("סונול עכו", stations)).toBeNull(); // two answer: not confident
    expect(stationForCharger("פז כרמיאל", stations)).toBeNull();
  });
});
