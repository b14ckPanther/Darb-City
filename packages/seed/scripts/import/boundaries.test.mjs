import { describe, expect, it } from "vitest";
import { createBoundaries, placeAt } from "./boundaries.mjs";
import { createPlaceMatcher } from "./places.mjs";

/** A square boundary relation from two ways, as Overpass returns with `out geom`. */
const square = (id, name, [s, w, n, e], role = "outer") => ({
  type: "relation",
  id,
  tags: { boundary: "administrative", admin_level: "8", name, "name:he": name },
  members: [
    {
      type: "way",
      role,
      geometry: [
        { lat: s, lon: w },
        { lat: s, lon: e },
        { lat: n, lon: e },
      ],
    },
    {
      type: "way",
      role,
      geometry: [
        { lat: n, lon: e },
        { lat: n, lon: w },
        { lat: s, lon: w },
      ],
    },
  ],
});

describe("boundaries", () => {
  const areas = createBoundaries([
    square(1, "חיפה", [32.73, 34.94, 32.85, 35.08]),
    square(2, "מועצה אזורית משגב", [32.8, 35.2, 32.95, 35.35]),
  ]);
  const matcher = createPlaceMatcher();

  it("finds the boundary a point stands in, from unordered ways", () => {
    expect(areas.at({ lat: 32.8, lng: 35.0 })?.name).toBe("חיפה");
    expect(areas.at({ lat: 32.8, lng: 35.1 })).toBeNull();
    expect(areas.at({ lat: 32.9, lng: 35.25 })?.regional).toBe(true);
  });
  it("places a point in its municipality before a nearer small village", () => {
    // Etgar's centre in places.json stands inside Haifa's boundary; Haifa's own centre is farther.
    const m = placeAt(matcher, areas, { lat: 32.7725, lng: 34.968 });
    expect(m.place.slug).toBe("haifa");
    expect(matcher.match({ lat: 32.7725, lng: 34.968 }).place.slug).toBe("etgar");
  });
  it("trusts the address's town first, and falls back to the nearest settlement", () => {
    expect(placeAt(matcher, areas, { town: "נשר", lat: 32.7709, lng: 35.0381 }).place.slug).toBe(
      "nesher",
    );
    expect(placeAt(matcher, createBoundaries([]), { lat: 32.8638, lng: 35.3023 }).place.slug).toBe(
      "sakhnin",
    );
  });
});
