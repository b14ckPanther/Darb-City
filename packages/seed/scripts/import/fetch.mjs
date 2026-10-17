// Network for the importers: data.gov.il's datastore API and OpenStreetMap's Overpass API, each
// response cached raw under .cache/ (gitignored) so a re-run reads the same data without asking.
// Pass --refresh to an importer to fetch again.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

export const UA = "Darb/1.0 (founder@darb.co.il)";
const CACHE = new URL("./.cache/", import.meta.url);
const refresh = process.argv.includes("--refresh");

/** Today as YYYY-MM-DD, for a source block's `fetched`. */
export const today = () => new Date().toISOString().slice(0, 10);

export async function cached(name, load) {
  const file = new URL(name, CACHE);
  if (!refresh && existsSync(file)) return JSON.parse(readFileSync(file, "utf8"));
  mkdirSync(CACHE, { recursive: true });
  const data = await load();
  writeFileSync(file, JSON.stringify(data));
  return data;
}

async function withRetry(what, run, tries = 5) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await run();
    } catch (error) {
      if (attempt >= tries) throw error;
      const wait = 2000 * 2 ** (attempt - 1);
      console.warn(`${what} failed (${error.message}), retrying in ${wait / 1000}s`);
      await sleep(wait);
    }
  }
}

/** Every record of a data.gov.il datastore resource (file downloads are refused, the API is not). */
export function datastore(resourceId) {
  return cached(`datastore-${resourceId}.json`, () =>
    withRetry(`datastore ${resourceId}`, async () => {
      const records = [];
      for (let offset = 0; ; offset += 5000) {
        const url = `https://data.gov.il/api/3/action/datastore_search?resource_id=${resourceId}&limit=5000&offset=${offset}`;
        const res = await fetch(url, { headers: { "User-Agent": UA } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const { result } = await res.json();
        records.push(...result.records);
        if (records.length >= result.total || result.records.length === 0) return records;
      }
    }),
  );
}

/** The north: every Darb place in the Northern and Haifa districts sits inside it. */
export const NORTH_BBOX = "32.3,34.85,33.35,35.9";

/**
 * An Overpass QL body run over the north; `name` keys the cache. Elements come with `center`.
 * `prelude` runs before the body's union (an area the body filters by, `->.il`); `out` is what
 * comes back ("geom" for boundaries).
 */
export function overpass(name, body, { prelude = "", out = "center tags" } = {}) {
  const query = `[out:json][timeout:180][bbox:${NORTH_BBOX}];
${prelude}
(${body});
out ${out};`;
  return cached(`overpass-${name}.json`, () => overpassQuery(name, query));
}

/** A whole Overpass QL query, uncached, with retries; resolves to its elements. */
export function overpassQuery(what, query) {
  return withRetry(`overpass ${what}`, async () => {
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query)}`,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    // Overpass answers a timed-out query with 200 and a remark instead of elements.
    if (json.remark && /runtime error|timed out|out of memory/i.test(json.remark))
      throw new Error(json.remark);
    return json.elements;
  });
}

/** An OSM element's point (nodes have lat/lon, ways and relations a center). */
export const pointOf = (el) =>
  el.lat !== undefined ? { lat: el.lat, lng: el.lon } : { lat: el.center.lat, lng: el.center.lon };
