// Overpass over the whole north in tiles: one query per tile, each tile cached raw under .cache/
// (gitignored), with retries, backoff and a second public endpoint when the first is full.
// Pass --refresh to fetch again. Data © OpenStreetMap contributors, ODbL.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { NORTH_BBOX, UA } from "./fetch.mjs";

const CACHE = new URL("./.cache/", import.meta.url);
const refresh = process.argv.includes("--refresh");

/** Public Overpass endpoints, tried in turn: the main one is often at capacity. */
export const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

/** The north's bbox split into `rows` x `cols` tiles: [south, west, north, east] each. */
export function tiles(bbox = NORTH_BBOX, rows = 5, cols = 5) {
  const [s, w, n, e] = bbox.split(",").map(Number);
  const out = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      out.push([
        +(s + ((n - s) * r) / rows).toFixed(4),
        +(w + ((e - w) * c) / cols).toFixed(4),
        +(s + ((n - s) * (r + 1)) / rows).toFixed(4),
        +(w + ((e - w) * (c + 1)) / cols).toFixed(4),
      ]);
  return out;
}

async function run(query, what) {
  let lastError;
  for (let attempt = 0; attempt < 8; attempt++) {
    const url = ENDPOINTS[attempt % ENDPOINTS.length];
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(query)}`,
        signal: globalThis.AbortSignal.timeout(240_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      // Overpass answers 200 with a remark when a query ran out of time or memory.
      if (body.remark && /runtime error|timed out|out of memory/i.test(body.remark))
        throw new Error(body.remark.slice(0, 120));
      return body.elements;
    } catch (error) {
      lastError = error;
      const wait = Math.min(60_000, 3000 * 2 ** attempt);
      console.warn(
        `${what} at ${new URL(url).host} failed (${error.message}), next in ${wait / 1000}s`,
      );
      await sleep(wait);
    }
  }
  throw lastError;
}

/**
 * Every element `body` (Overpass QL statements, without bbox) finds in the north, fetched tile by
 * tile and merged by type/id. `name` keys the cache: .cache/overpass-<name>-<tile>.json.
 */
export async function overpassTiles(name, body, { rows = 5, cols = 5 } = {}) {
  mkdirSync(CACHE, { recursive: true });
  const seen = new Map();
  const all = tiles(NORTH_BBOX, rows, cols);
  for (const [i, t] of all.entries()) {
    const file = new URL(`overpass-${name}-${rows}x${cols}-${i}.json`, CACHE);
    let elements;
    if (!refresh && existsSync(file)) elements = JSON.parse(readFileSync(file, "utf8"));
    else {
      const query = `[out:json][timeout:200][bbox:${t.join(",")}];\n(${body});\nout center tags;`;
      elements = await run(query, `overpass ${name} tile ${i + 1}/${all.length}`);
      writeFileSync(file, JSON.stringify(elements));
      await sleep(1500);
    }
    for (const el of elements) seen.set(`${el.type}/${el.id}`, el);
  }
  return [...seen.values()];
}
