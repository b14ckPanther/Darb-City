import { describe, expect, it } from "vitest";
import { cityCollection, glowRadius, pinCollection } from "./density.js";

describe("density", () => {
  it("glows nothing for an empty place and most for the busiest", () => {
    expect(glowRadius(0, 50)).toBe(0);
    expect(glowRadius(50, 50)).toBe(24);
    expect(glowRadius(1, 100)).toBe(7.8);
    expect(glowRadius(5, 0)).toBe(0);
  });
  it("turns live places into a GeoJSON collection with their glow", () => {
    const fc = cityCollection([
      { slug: "a", name: "A", lat: 32, lng: 35, count: 10, href: "/a" },
      { slug: "b", name: "B", lat: 33, lng: 35.5, count: 0, href: "/b" },
    ]);
    expect(fc.type).toBe("FeatureCollection");
    expect(fc.features[0]).toEqual({
      type: "Feature",
      geometry: { type: "Point", coordinates: [35, 32] },
      properties: { slug: "a", name: "A", href: "/a", count: 10, glow: 24 },
    });
    expect(fc.features[1]?.properties.glow).toBe(0);
  });
  it("marks the open business's pin", () => {
    const fc = pinCollection(
      [
        { key: "s/a", href: "/s/k/a", name: "A", lat: 32, lng: 35 },
        { key: "s/b", href: "/s/k/b", name: "B", lat: 32.1, lng: 35.1 },
      ],
      "/s/k/b",
    );
    expect(fc.features.map((f) => f.properties.active)).toEqual([false, true]);
  });
});
