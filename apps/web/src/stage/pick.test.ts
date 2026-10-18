// @vitest-environment node
import { describe, expect, it } from "vitest";
import { CLUSTER_PIN, HOT_PIN, PIN_LAYER } from "./map-layers";
import { HIT_BOX, pickAt, PICKABLE, type PickableMap } from "./pick";

type Pixel = [number, number];
type Box = [Pixel, Pixel];

interface FakeFeature {
  layer: string;
  properties: Record<string, unknown>;
  /** Where the feature's point is on screen (the fake map projects lng/lat as pixels). */
  at: [number, number];
  r: number;
}

const pin = (key: string, x: number, y: number, layer = PIN_LAYER): FakeFeature => ({
  layer,
  properties: { key, href: `/sakhnin/beauty/barbershops/${key}`, n: 1 },
  at: [x, y],
  r: 11,
});
const cluster = (id: number, x: number, y: number): FakeFeature => ({
  layer: CLUSTER_PIN,
  properties: { cluster_id: id, point_count: 4 },
  at: [x, y],
  r: 13,
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
        .filter((f) => f.at[0] - f.r <= x1 && f.at[0] + f.r >= x0)
        .filter((f) => f.at[1] - f.r <= y1 && f.at[1] + f.r >= y0)
        .sort((a, b) => layers.indexOf(a.layer) - layers.indexOf(b.layer))
        .map((f) => ({
          layer: { id: f.layer },
          properties: f.properties,
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

  it("takes a pin 15 px from the tap", () => {
    const { map } = fakeMap([pin("samers", 100, 100)]);
    expect(pickAt(map, { x: 115, y: 100 })).toEqual({
      type: "pin",
      key: "samers",
      href: "/sakhnin/beauty/barbershops/samers",
    });
  });

  it("takes the pin nearest the tap, not the first one found", () => {
    const { map } = fakeMap([pin("a", 100, 100), pin("b", 120, 100)]);
    expect(pickAt(map, { x: 114, y: 100 })).toMatchObject({ key: "b" });
    expect(pickAt(map, { x: 106, y: 100 })).toMatchObject({ key: "a" });
  });

  it("prefers the lifted pin over the same pin beneath it", () => {
    const { map } = fakeMap([pin("a", 100, 100), pin("a-hot", 100, 100, HOT_PIN)]);
    expect(pickAt(map, { x: 100, y: 100 })).toMatchObject({ key: "a-hot" });
  });

  it("reports a merged pin as a cluster to zoom into", () => {
    const { map } = fakeMap([cluster(7, 50, 50)]);
    expect(pickAt(map, { x: 58, y: 54 })).toEqual({ type: "cluster", id: 7, at: [50, 50] });
  });

  it("finds nothing on empty ground", () => {
    const { map } = fakeMap([pin("a", 100, 100)]);
    expect(pickAt(map, { x: 200, y: 200 })).toBeNull();
  });

  it("picks only pins: places are chosen from the list, never from the map", () => {
    expect(PICKABLE).toEqual([HOT_PIN, PIN_LAYER, CLUSTER_PIN]);
  });
});
