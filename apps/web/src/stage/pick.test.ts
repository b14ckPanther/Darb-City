// @vitest-environment node
import { describe, expect, it } from "vitest";
import { CITY_DOT, CITY_GLOW, CITY_LABEL, PIN_LAYER } from "./map-layers";
import { HIT_BOX, pickAt, PICKABLE, type PickableMap } from "./pick";

type Pixel = [number, number];
type Box = [Pixel, Pixel];

interface FakeFeature {
  layer: string;
  href: string;
  /** Where the feature's point is on screen (the fake map projects lng/lat as pixels). */
  at: [number, number];
  /** What the feature covers on screen: a dot's disc, a label's text box. */
  covers: { x0: number; y0: number; x1: number; y1: number };
}

const dot = (layer: string, href: string, x: number, y: number, r = 4): FakeFeature => ({
  layer,
  href,
  at: [x, y],
  covers: { x0: x - r, y0: y - r, x1: x + r, y1: y + r },
});

const label = (href: string, x: number, y: number): FakeFeature => ({
  layer: CITY_LABEL,
  href,
  at: [x, y],
  // Text under its dot (anchor "top"), 60 px wide.
  covers: { x0: x - 30, y0: y + 8, x1: x + 30, y1: y + 24 },
});

const isBox = (geometry: Pixel | Box): geometry is Box => Array.isArray(geometry[0]);

/** A map whose queries return what overlaps the asked point or box, topmost layer first. */
function fakeMap(features: FakeFeature[]) {
  const queries: (Pixel | Box)[] = [];
  const map: PickableMap = {
    queryRenderedFeatures(geometry, options) {
      queries.push(geometry);
      const [[x0, y0], [x1, y1]] = isBox(geometry) ? geometry : [geometry, geometry];
      const layers = options.layers;
      return features
        .filter((f) => layers.includes(f.layer))
        .filter((f) => f.covers.x0 <= x1 && f.covers.x1 >= x0)
        .filter((f) => f.covers.y0 <= y1 && f.covers.y1 >= y0)
        .sort((a, b) => layers.indexOf(a.layer) - layers.indexOf(b.layer))
        .map((f) => ({
          layer: { id: f.layer },
          properties: { href: f.href },
          geometry: { type: "Point", coordinates: f.at },
        }));
    },
    project: ([lng, lat]) => ({ x: lng, y: lat }),
  };
  return { map, queries };
}

describe("pickAt", () => {
  it("asks for a 44 × 44 px box around the tap", () => {
    const { map, queries } = fakeMap([]);
    pickAt(map, { x: 100, y: 200 });
    expect(HIT_BOX).toBe(44);
    expect(queries).toContainEqual([
      [78, 178],
      [122, 222],
    ]);
  });

  it("takes a place whose 8 px dot is 15 px from the tap", () => {
    const { map } = fakeMap([dot(CITY_DOT, "/sakhnin", 100, 100)]);
    expect(pickAt(map, { x: 115, y: 100 })).toEqual({ href: "/sakhnin", kind: "place" });
  });

  it("takes the dot nearest the tap, not the first one found", () => {
    const { map } = fakeMap([
      dot(CITY_DOT, "/arraba", 100, 100),
      dot(CITY_DOT, "/sakhnin", 120, 100),
    ]);
    expect(pickAt(map, { x: 114, y: 100 })).toEqual({ href: "/sakhnin", kind: "place" });
    expect(pickAt(map, { x: 106, y: 100 })).toEqual({ href: "/arraba", kind: "place" });
  });

  it("takes a place by its name", () => {
    const { map } = fakeMap([label("/sakhnin", 100, 100), dot(CITY_DOT, "/arraba", 120, 125)]);
    // On Sakhnin's name, 20 px under its dot: Arraba's dot is nearer, but the name is under the tap.
    expect(pickAt(map, { x: 100, y: 120 })).toEqual({ href: "/sakhnin", kind: "place" });
  });

  it("does not let a big glow beat a nearer dot", () => {
    const glow: FakeFeature = {
      ...dot(CITY_GLOW, "/sakhnin", 100, 100),
      covers: { x0: 40, y0: 40, x1: 160, y1: 160 },
    };
    const { map } = fakeMap([glow, dot(CITY_DOT, "/arraba", 140, 100)]);
    expect(pickAt(map, { x: 132, y: 100 })).toEqual({ href: "/arraba", kind: "place" });
  });

  it("reports a business pin as a business", () => {
    const { map } = fakeMap([dot(PIN_LAYER, "/sakhnin/beauty/barbershops/samers", 50, 50, 8)]);
    expect(pickAt(map, { x: 62, y: 58 })).toEqual({
      href: "/sakhnin/beauty/barbershops/samers",
      kind: "business",
    });
  });

  it("finds nothing on empty ground", () => {
    const { map } = fakeMap([dot(CITY_DOT, "/sakhnin", 100, 100)]);
    expect(pickAt(map, { x: 200, y: 200 })).toBeNull();
  });

  it("can pick names, dots, glows and pins", () => {
    expect([...PICKABLE].sort()).toEqual([CITY_DOT, CITY_GLOW, CITY_LABEL, PIN_LAYER].sort());
  });
});
