// The land Darb serves, as one smooth outline around its own places (packages/seed places.json):
// every place becomes a disc of SERVED_KM, gaps up to ~2 × CLOSE_KM between discs are closed,
// holes are filled, and the edge is traced, simplified and rounded. Not a political border: it is
// only where Darb's places are. copy-map.mjs writes it to public/map/served-area.json, and the
// maps fade everything outside it into the night (src/stage/served-area.ts).
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadPlaces } from "@darb/seed";

/** Grid cell, in degrees. */
export const STEP = 0.01;
export const SERVED_KM = 7;
export const CLOSE_KM = 5;
/** Douglas–Peucker tolerance, in degrees. */
export const TOLERANCE = 0.005;
const KM_PER_DEG = 111.32;
const DECIMALS = 3;

/**
 * A boolean grid around the points, origin snapped to STEP. Cell (i, j) is at
 * (lng0 + i·STEP, lat0 + j·STEP); `pad` cells of empty margin on every side.
 */
export function rasterise(points, pad) {
  // Each point in its nearest cell (rounding, so 32.02 / 0.01 is cell 3202, not 3203).
  const is = points.map((p) => Math.round(p[0] / STEP));
  const js = points.map((p) => Math.round(p[1] / STEP));
  const i0 = Math.min(...is) - pad;
  const j0 = Math.min(...js) - pad;
  const w = Math.max(...is) + pad - i0 + 1;
  const h = Math.max(...js) + pad - j0 + 1;
  const cells = new Uint8Array(w * h);
  for (let k = 0; k < points.length; k++) cells[(js[k] - j0) * w + (is[k] - i0)] = 1;
  return { w, h, lng0: i0 * STEP, lat0: j0 * STEP, cells };
}

/** Cell offsets within km of a cell, at the grid's middle latitude. */
function disc(grid, km) {
  const midLat = grid.lat0 + (grid.h * STEP) / 2;
  const kx = KM_PER_DEG * STEP * Math.cos((midLat * Math.PI) / 180);
  const ky = KM_PER_DEG * STEP;
  const ri = Math.floor(km / kx);
  const rj = Math.floor(km / ky);
  const offsets = [];
  for (let dj = -rj; dj <= rj; dj++)
    for (let di = -ri; di <= ri; di++)
      if ((di * kx) ** 2 + (dj * ky) ** 2 <= km * km) offsets.push([di, dj]);
  return offsets;
}

function stamp(grid, cells, value, offsets) {
  const { w, h } = grid;
  const out = new Uint8Array(cells.length).fill(value ? 0 : 1);
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      if (cells[j * w + i] !== value) continue;
      for (const [di, dj] of offsets) {
        const x = i + di;
        const y = j + dj;
        if (x >= 0 && y >= 0 && x < w && y < h) out[y * w + x] = value;
      }
    }
  return out;
}

/** Every cell within km of a set cell. */
export function dilate(grid, km) {
  return { ...grid, cells: stamp(grid, grid.cells, 1, disc(grid, km)) };
}

/** Only the cells whose whole km disc is set. */
export function erode(grid, km) {
  return { ...grid, cells: stamp(grid, grid.cells, 0, disc(grid, km)) };
}

/** Empty cells the outside cannot reach (4-connected) become set. */
export function fillHoles(grid) {
  const { w, h, cells } = grid;
  const outside = new Uint8Array(cells.length);
  const queue = [];
  const visit = (i, j) => {
    const k = j * w + i;
    if (cells[k] || outside[k]) return;
    outside[k] = 1;
    queue.push(k);
  };
  for (let i = 0; i < w; i++) {
    visit(i, 0);
    visit(i, h - 1);
  }
  for (let j = 0; j < h; j++) {
    visit(0, j);
    visit(w - 1, j);
  }
  while (queue.length) {
    const k = queue.pop();
    const i = k % w;
    const j = (k - i) / w;
    if (i > 0) visit(i - 1, j);
    if (i < w - 1) visit(i + 1, j);
    if (j > 0) visit(i, j - 1);
    if (j < h - 1) visit(i, j + 1);
  }
  return { ...grid, cells: outside.map((o) => (o ? 0 : 1)) };
}

/** The set cells as 0/1 values, box-blurred (radius r, twice) so the traced edge is smooth. */
export function blur(grid, r) {
  const { w, h } = grid;
  let values = Float64Array.from(grid.cells);
  const pass = (src, horizontal) => {
    const out = new Float64Array(src.length);
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        let sum = 0;
        for (let d = -r; d <= r; d++) {
          const x = horizontal ? i + d : i;
          const y = horizontal ? j : j + d;
          if (x >= 0 && y >= 0 && x < w && y < h) sum += src[y * w + x];
        }
        out[j * w + i] = sum / (2 * r + 1);
      }
    return out;
  };
  for (let n = 0; n < 2; n++) values = pass(pass(values, true), false);
  return { ...grid, values };
}

/**
 * Marching squares at threshold t: closed rings in grid units, the inside on the left (outer rings
 * counter-clockwise, holes clockwise). Saddles follow the cell's mean value.
 */
export function contour({ w, h, values }, t = 0.5) {
  const inside = (i, j) => values[j * w + i] >= t;
  const points = new Map();
  const point = (key) => {
    let p = points.get(key);
    if (p) return p;
    const k = key >> 1;
    const i = k % w;
    const j = (k - i) / w;
    const [i2, j2] = key & 1 ? [i, j + 1] : [i + 1, j];
    const a = values[j * w + i];
    const f = (t - a) / (values[j2 * w + i2] - a);
    p = [i + f * (i2 - i), j + f * (j2 - j)];
    points.set(key, p);
    return p;
  };
  const H = (i, j) => (j * w + i) * 2;
  const V = (i, j) => (j * w + i) * 2 + 1;
  const next = new Map();
  for (let j = 0; j < h - 1; j++)
    for (let i = 0; i < w - 1; i++) {
      const corners = [inside(i, j), inside(i + 1, j), inside(i + 1, j + 1), inside(i, j + 1)];
      const edges = [H(i, j), V(i + 1, j), H(i, j + 1), V(i, j)];
      const crossings = [];
      for (let e = 0; e < 4; e++) {
        const from = corners[e];
        const to = corners[(e + 1) % 4];
        if (from !== to) crossings.push({ key: edges[e], out: from });
      }
      if (crossings.length === 2) {
        const [o, n] = crossings[0].out ? crossings : [crossings[1], crossings[0]];
        next.set(o.key, n.key);
      } else if (crossings.length === 4) {
        const mean =
          (values[j * w + i] +
            values[j * w + i + 1] +
            values[(j + 1) * w + i + 1] +
            values[(j + 1) * w + i]) /
          4;
        const shift = mean >= t ? 1 : 3;
        for (let c = 0; c < 4; c++)
          if (crossings[c].out) next.set(crossings[c].key, crossings[(c + shift) % 4].key);
      }
    }
  const rings = [];
  const seen = new Set();
  for (const start of next.keys()) {
    if (seen.has(start)) continue;
    const ring = [];
    let key = start;
    do {
      seen.add(key);
      ring.push(point(key));
      key = next.get(key);
    } while (key !== start && key !== undefined);
    ring.push(ring[0]);
    rings.push(ring);
  }
  return rings;
}

/** Twice the signed area: positive for counter-clockwise rings. */
export function signedArea(ring) {
  let sum = 0;
  for (let k = 0; k < ring.length - 1; k++)
    sum += ring[k][0] * ring[k + 1][1] - ring[k + 1][0] * ring[k][1];
  return sum;
}

function segmentDistance(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = dx * dx + dy * dy;
  const u =
    len === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len));
  return Math.hypot(p[0] - a[0] - u * dx, p[1] - a[1] - u * dy);
}

/** Douglas–Peucker on a closed ring (first point equals last). */
export function simplify(ring, tolerance) {
  const keep = new Uint8Array(ring.length);
  keep[0] = keep[ring.length - 1] = 1;
  const stack = [[0, ring.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let far = -1;
    let best = tolerance;
    for (let k = a + 1; k < b; k++) {
      const d = segmentDistance(ring[k], ring[a], ring[b]);
      if (d <= best) continue;
      best = d;
      far = k;
    }
    if (far < 0) continue;
    keep[far] = 1;
    stack.push([a, far], [far, b]);
  }
  return ring.filter((_, k) => keep[k]);
}

/** One round of Chaikin corner cutting on a closed ring. */
export function smooth(ring) {
  const out = [];
  for (let k = 0; k < ring.length - 1; k++) {
    const [a, b] = [ring[k], ring[k + 1]];
    out.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]]);
    out.push([0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]]);
  }
  out.push(out[0]);
  return out;
}

const round = (n) => Number(n.toFixed(DECIMALS));

/**
 * The served outline around [lng, lat] points: a GeoJSON Feature with a MultiPolygon of outer
 * rings only (counter-clockwise, holes filled) and its bbox. Deterministic for the same points.
 */
export function servedArea(points, options = {}) {
  const { servedKm = SERVED_KM, closeKm = CLOSE_KM, tolerance = TOLERANCE } = options;
  const pad = Math.ceil((servedKm + closeKm) / (KM_PER_DEG * STEP * 0.8)) + 8;
  let grid = rasterise(points, pad);
  grid = erode(dilate(grid, servedKm + closeKm), closeKm);
  grid = fillHoles(grid);
  const field = blur(grid, 2);
  const rings = contour(field)
    .filter((ring) => signedArea(ring) > 0)
    .map((ring) =>
      smooth(
        simplify(
          ring.map(([i, j]) => [grid.lng0 + i * STEP, grid.lat0 + j * STEP]),
          tolerance,
        ),
      )
        .map(([lng, lat]) => [round(lng), round(lat)])
        .filter((p, k, all) => k === 0 || p[0] !== all[k - 1][0] || p[1] !== all[k - 1][1]),
    )
    .filter((ring) => ring.length >= 4);
  const all = rings.flat();
  const bbox = [
    Math.min(...all.map((p) => p[0])),
    Math.min(...all.map((p) => p[1])),
    Math.max(...all.map((p) => p[0])),
    Math.max(...all.map((p) => p[1])),
  ];
  return {
    type: "Feature",
    bbox,
    properties: {},
    geometry: { type: "MultiPolygon", coordinates: rings.map((ring) => [ring]) },
  };
}

/** Darb's places as [lng, lat]: towns, cities, villages and neighbourhoods (no country or region). */
export function placePoints(places) {
  return places
    .filter((p) => p.type !== "country" && p.type !== "region")
    .filter((p) => typeof p.lat === "number" && typeof p.lng === "number")
    .map((p) => [p.lng, p.lat]);
}

export function writeServedArea(file) {
  const feature = servedArea(placePoints(loadPlaces()));
  const body = JSON.stringify(feature);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, body);
  return { file, bytes: body.length, rings: feature.geometry.coordinates.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { file, bytes, rings } = writeServedArea(
    fileURLToPath(new URL("../../public/map/served-area.json", import.meta.url)),
  );
  console.log(`served area: ${rings} rings, ${bytes} bytes -> ${file}`);
}
