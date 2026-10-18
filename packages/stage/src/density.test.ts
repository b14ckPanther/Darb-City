import { describe, expect, it } from "vitest";
import { heatCollection, hereCollection, pinCollection } from "./density.js";

describe("map data", () => {
  it("warms where businesses are, by the log of their count, never empty places", () => {
    const fc = heatCollection([
      { slug: "a", lat: 32, lng: 35, count: 1000 },
      { slug: "b", lat: 33, lng: 35.5, count: 9 },
      { slug: "c", lat: 33, lng: 35.6, count: 0 },
    ]);
    expect(fc.type).toBe("FeatureCollection");
    expect(fc.features).toHaveLength(2);
    expect(fc.features[0]).toEqual({
      type: "Feature",
      geometry: { type: "Point", coordinates: [35, 32] },
      properties: { weight: 1 },
    });
    // A village of 9 next to a city of 1,000 still reads at a third, not at 1 %.
    expect(fc.features[1]?.properties.weight).toBe(0.33);
    expect(JSON.stringify(fc)).not.toContain("count");
  });
  it("marks the level's place, and nothing for the country or a nationwide search", () => {
    expect(hereCollection({ slug: "haifa", name: "Haifa", lat: 32.79, lng: 34.99 })).toEqual({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [34.99, 32.79] },
          properties: { name: "Haifa" },
        },
      ],
    });
    expect(hereCollection(null).features).toEqual([]);
    expect(hereCollection({ slug: "", name: "", lat: 32, lng: 35 }).features).toEqual([]);
  });
  it("numbers pins in list order, and leaves a preview's pins unnumbered", () => {
    const pins = [
      { key: "s/a", href: "/s/k/a", name: "A", lat: 32, lng: 35 },
      { key: "s/b", href: "/s/k/b", name: "B", lat: 32.1, lng: 35.1 },
    ];
    expect(pinCollection(pins).features.map((f) => f.properties)).toEqual([
      { key: "s/a", name: "A", href: "/s/k/a", n: 1 },
      { key: "s/b", name: "B", href: "/s/k/b", n: 2 },
    ]);
    expect(pinCollection(pins, { numbered: false }).features.map((f) => f.properties.n)).toEqual([
      0, 0,
    ]);
  });
});
