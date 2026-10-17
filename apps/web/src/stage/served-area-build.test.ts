// @vitest-environment node
import { loadPlaces } from "@darb/seed";
import { describe, expect, it } from "vitest";
import {
  contour,
  fillHoles,
  placePoints,
  rasterise,
  servedArea,
  signedArea,
  simplify,
  STEP,
} from "../../scripts/map/served-area.mjs";

type Ring = number[][];

/** Ray casting: is p inside the closed ring? */
function inRing(point: number[], ring: Ring): boolean {
  const [x, y] = point as [number, number];
  let inside = false;
  for (let a = 0, b = ring.length - 2; a < ring.length - 1; b = a++) {
    const [xa, ya] = ring[a] as [number, number];
    const [xb, yb] = ring[b] as [number, number];
    if (ya > y !== yb > y && x < ((xb - xa) * (y - ya)) / (yb - ya) + xa) inside = !inside;
  }
  return inside;
}

const rings = (feature: { geometry: { coordinates: Ring[][] } }) =>
  feature.geometry.coordinates.map((polygon) => polygon[0]!);

describe("the served outline, step by step", () => {
  it("rasterises points onto a padded grid snapped to the step", () => {
    const grid = rasterise(
      [
        [35, 32],
        [35.05, 32.02],
      ],
      3,
    );
    expect(grid.w).toBe(5 + 1 + 6);
    expect(grid.h).toBe(2 + 1 + 6);
    expect(grid.lng0).toBeCloseTo(35 - 3 * STEP);
    expect(grid.lat0).toBeCloseTo(32 - 3 * STEP);
    expect([...grid.cells].filter(Boolean)).toHaveLength(2);
    expect(grid.cells[3 * grid.w + 3]).toBe(1);
  });

  it("fills holes the outside cannot reach", () => {
    // A 5×5 grid with a 3×3 ring of set cells around one empty cell.
    const cells = new Uint8Array(25);
    for (let j = 1; j <= 3; j++) for (let i = 1; i <= 3; i++) cells[j * 5 + i] = 1;
    cells[2 * 5 + 2] = 0;
    const filled = fillHoles({ w: 5, h: 5, lng0: 0, lat0: 0, cells });
    expect(filled.cells[2 * 5 + 2]).toBe(1);
    expect(filled.cells[0]).toBe(0);
  });

  it("traces one closed counter-clockwise ring around a blob", () => {
    const values = new Float64Array(16);
    values[1 * 4 + 1] = values[1 * 4 + 2] = values[2 * 4 + 1] = values[2 * 4 + 2] = 1;
    const traced = contour({ w: 4, h: 4, values }, 0.5);
    expect(traced).toHaveLength(1);
    const ring = traced[0] as Ring;
    expect(ring[0]).toEqual(ring.at(-1));
    expect(signedArea(ring)).toBeGreaterThan(0);
    expect(inRing([1.5, 1.5], ring)).toBe(true);
    expect(inRing([0.2, 0.2], ring)).toBe(false);
  });

  it("simplifies a ring within the tolerance", () => {
    const ring: Ring = [
      [0, 0],
      [1, 0.001],
      [2, 0],
      [2, 2],
      [0, 2],
      [0, 0],
    ];
    expect(simplify(ring, 0.01)).toEqual([
      [0, 0],
      [2, 0],
      [2, 2],
      [0, 2],
      [0, 0],
    ]);
  });
});

describe("servedArea", () => {
  it("joins near places into one area and keeps a far one apart", () => {
    const near = servedArea([
      [35, 32],
      [35.1, 32],
    ]);
    expect(rings(near)).toHaveLength(1);
    const apart = servedArea([
      [35, 32],
      [35, 31],
    ]);
    expect(rings(apart)).toHaveLength(2);
    for (const ring of rings(apart)) {
      expect(ring[0]).toEqual(ring.at(-1));
      expect(signedArea(ring)).toBeGreaterThan(0);
    }
  });

  it("covers every place with land around it, and no more than a little past it", () => {
    const area = servedArea([[35, 32]]);
    const [ring] = rings(area);
    expect(inRing([35, 32], ring!)).toBe(true);
    // ~7 km each way (0.06° of latitude), not 20.
    expect(inRing([35, 32.05], ring!)).toBe(true);
    expect(inRing([35, 32.15], ring!)).toBe(false);
    expect(area.bbox[0]).toBeLessThan(35);
    expect(area.bbox[3]).toBeGreaterThan(32);
  });

  it("is small and deterministic for Darb's own places, and covers each of them", () => {
    const points = placePoints(loadPlaces());
    expect(points.length).toBeGreaterThan(1000);
    const area = servedArea(points);
    const body = JSON.stringify(area);
    expect(body.length).toBeLessThan(15 * 1024);
    expect(JSON.stringify(servedArea(points))).toBe(body);
    const all = rings(area);
    for (const p of points)
      expect(
        all.some((ring) => inRing(p, ring)),
        String(p),
      ).toBe(true);
  });

  it("leaves the country and its regions out of the points", () => {
    const points = placePoints([
      { type: "country", lat: 31.5, lng: 34.9 },
      { type: "region", lat: 32.9, lng: 35.3 },
      { type: "town", lat: 32.9, lng: 35.3 },
    ]);
    expect(points).toEqual([[35.3, 32.9]]);
  });
});
