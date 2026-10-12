import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { toSlug, type Localized, type PlaceType } from "@darb/core";
import type { SeedPlace } from "../src/types.js";

const DATA = (file: string) => new URL(`../data/${file}`, import.meta.url);
const UA = "DarbCitySeed/1.0 (+https://darb.co.il)";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** CBS sub-district code -> region slug. Sub-districts 71-77 (Judea and Samaria) are excluded. */
const REGION_OF: Record<number, string> = {
  11: "jerusalem-district",
  21: "northern-district", 22: "northern-district", 23: "northern-district",
  24: "northern-district", 25: "northern-district", 29: "northern-district",
  31: "haifa-district", 32: "haifa-district",
  41: "central-district", 42: "central-district", 43: "central-district", 44: "central-district",
  51: "tel-aviv-district", 52: "tel-aviv-district", 53: "tel-aviv-district",
  61: "southern-district", 62: "southern-district",
};
const LIVE_REGIONS = new Set(["northern-district", "haifa-district"]);
const REGIONS: Record<string, { name: Localized; lat: number; lng: number }> = {
  "northern-district": { name: { he: "מחוז הצפון", ar: "اللواء الشمالي", en: "Northern District" }, lat: 32.88, lng: 35.38 },
  "haifa-district": { name: { he: "מחוז חיפה", ar: "لواء حيفا", en: "Haifa District" }, lat: 32.62, lng: 35.0 },
  "central-district": { name: { he: "מחוז המרכז", ar: "اللواء الأوسط", en: "Central District" }, lat: 32.1, lng: 34.9 },
  "tel-aviv-district": { name: { he: "מחוז תל אביב", ar: "لواء تل أبيب", en: "Tel Aviv District" }, lat: 32.07, lng: 34.79 },
  "jerusalem-district": { name: { he: "מחוז ירושלים", ar: "لواء القدس", en: "Jerusalem District" }, lat: 31.77, lng: 35.1 },
  "southern-district": { name: { he: "מחוז הדרום", ar: "اللواء الجنوبي", en: "Southern District" }, lat: 30.9, lng: 34.8 },
};

interface CbsRow { code: string; he: string; en: string; sub: number }
interface OsmHit {
  lat: string; lon: string; category: string; addresstype: string;
  namedetails?: Record<string, string>;
}
interface Overrides { byCbsCode: Record<string, Partial<SeedPlace>>; extra: SeedPlace[] }

async function loadCbs(): Promise<CbsRow[]> {
  const url = "https://data.gov.il/api/3/action/datastore_search?resource_id=5c78e9fa-c2e2-4771-93ff-7f400a12f7ba&limit=5000";
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  const records = ((await res.json()) as { result: { records: Record<string, string | number>[] } }).result.records;
  return records
    .map((r) => ({
      code: String(r["סמל_ישוב"]).trim(),
      he: String(r["שם_ישוב"]).trim(),
      en: String(r["שם_ישוב_לועזי"] ?? "").trim(),
      sub: Number(r["סמל_נפה"]),
    }))
    .filter((r) => r.code !== "0" && r.he !== "" && REGION_OF[r.sub]);
}

const overrides = JSON.parse(readFileSync(DATA("places-overrides.json"), "utf8")) as Overrides;
const titleCase = (s: string) => s.toLowerCase().replace(/(^|[\s\-'(])(\p{L})/gu, (_m, p: string, c: string) => p + c.toUpperCase());
const TYPE: Record<string, PlaceType> = { city: "city", town: "town", village: "village", hamlet: "village", isolated_dwelling: "village", suburb: "neighbourhood" };

async function geocode(he: string): Promise<OsmHit | null> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(he)}&countrycodes=il&format=jsonv2&namedetails=1&limit=5`;
  const hits = (await (await fetch(url, { headers: { "User-Agent": UA } })).json()) as OsmHit[];
  return hits.find((h) => h.category === "place" || (h.category === "boundary" && h.addresstype in TYPE)) ?? null;
}

// Cache: rows already in places.json with coordinates are reused, so a re-run only hits Nominatim for unresolved rows.
const cache = new Map<string, SeedPlace>();
if (existsSync(DATA("places.json"))) {
  for (const p of JSON.parse(readFileSync(DATA("places.json"), "utf8")) as SeedPlace[])
    if (p.cbsCode && p.lat !== 0 && p.lng !== 0) cache.set(p.cbsCode, p);
}

const cbs = await loadCbs();
const places: SeedPlace[] = [
  { slug: "israel", cbsCode: null, type: "country", parent: null, name: { he: "ישראל", ar: "إسرائيل", en: "Israel" }, aliases: ["البلاد"], lat: 31.5, lng: 34.9, status: "live" },
  ...Object.entries(REGIONS).map(([slug, r]): SeedPlace => ({
    slug, cbsCode: null, type: "region", parent: "israel", name: r.name, aliases: [], lat: r.lat, lng: r.lng,
    status: LIVE_REGIONS.has(slug) ? "live" : "soon",
  })),
];
const review: string[] = [];
const used = new Set(places.map((p) => p.slug));
for (const x of overrides.extra) used.add(x.slug);

for (const [i, row] of cbs.entries()) {
  const o = overrides.byCbsCode[row.code] ?? {};
  const cached = cache.get(row.code);
  let hit: OsmHit | null = null;
  if (!cached) {
    await sleep(1100);
    try { hit = await geocode(row.he); } catch (e) { console.error(`geocode failed ${row.code}`, e); }
  }
  const region = REGION_OF[row.sub]!;
  const nd = hit?.namedetails ?? {};
  const en = o.name?.en ?? cached?.name.en ?? (nd["name:en"] || (row.en ? titleCase(row.en) : ""));
  const ar = (o.name?.ar ?? cached?.name.ar ?? nd["name:ar"] ?? "").replace(/[\u200e\u200f]/g, "").trim();
  let slug = o.slug ?? toSlug(en || `cbs-${row.code}`);
  if (!slug) slug = `cbs-${row.code}`;
  if (used.has(slug)) slug = `${slug}-${row.code}`;
  used.add(slug);
  const lat = o.lat ?? cached?.lat ?? (hit ? Number(hit.lat) : 0);
  const lng = o.lng ?? cached?.lng ?? (hit ? Number(hit.lon) : 0);
  if (!lat || !lng) review.push(`- ${row.code} ${row.he}: no OpenStreetMap match, coordinates missing`);
  if (!ar) review.push(`- ${row.code} ${row.he}: missing Arabic name`);
  if (!en) review.push(`- ${row.code} ${row.he}: missing English name`);
  places.push({
    slug,
    cbsCode: row.code,
    type: o.type ?? cached?.type ?? TYPE[hit?.addresstype ?? ""] ?? "village",
    parent: region,
    name: { he: row.he, ar, en },
    aliases: [...new Set([row.en, ...(o.aliases ?? [])].filter((a) => a && a !== en))],
    lat,
    lng,
    status: LIVE_REGIONS.has(region) ? "live" : "soon",
  });
  if (i % 50 === 0) console.log(`${i}/${cbs.length}`);
}
places.push(...overrides.extra);

writeFileSync(DATA("places.json"), `${JSON.stringify(places, null, 2)}\n`);
writeFileSync(DATA("places-review.md"), `# Places needing review\n\n${review.join("\n") || "None."}\n`);
console.log(`${places.length} places, ${review.length} review notes`);
