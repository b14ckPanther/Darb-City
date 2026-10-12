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
    .filter((r) => r.code !== "0" && r.he !== "" && REGION_OF[r.sub])
    .filter((r) => !r.he.startsWith("מחנה")); // military camps are not localities
}

const overrides = JSON.parse(readFileSync(DATA("places-overrides.json"), "utf8")) as Overrides;
const titleCase = (s: string) => s.toLowerCase().replace(/(^|[\s\-(])(\p{L})/gu, (_m, p: string, c: string) => p + c.toUpperCase());
/** Normalise English names: space before "(", no capital right after an apostrophe. */
const tidyEn = (s: string) =>
  s.replace(/(\S)\(/g, "$1 (").replace(/(['`\u2019])(\p{Lu})/gu, (_m, a: string, c: string) => a + c.toLowerCase());
/** Municipal status (controller ruling): city = municipality, town = local council, everything else village. */
const CITY_CBS_CODES = new Set(["3000", "5000", "4000", "8300", "7900", "70", "7400", "9000", "6100", "6600", "8600", "7100", "8400", "6200", "2610", "6900", "6400", "6500", "1200", "7000", "8700", "8500", "2650", "7300", "7600", "9100", "2600", "6800", "2630", "8200", "9500", "9600", "2800", "1034", "2620", "2400", "1020", "31", "1309", "2710", "6000", "2730", "2720", "8900", "7500", "8800", "1139", "1063", "8000", "6700", "7700", "9200", "2660", "2550", "6300", "9700", "2640", "7200", "2500", "2100", "240", "2200", "2560", "246", "1031", "9400", "681", "874", "1061", "166", "1161"]);
const TOWN_CBS_CODES = new Set(["472", "473", "182", "565", "529", "2024", "652", "2530", "482", "4001", "480", "466", "9800", "1326", "483", "1292", "627", "541", "628", "229", "489", "494", "492", "490", "1290", "2034", "496", "1303", "1247", "962", "498", "1295", "499", "29", "502", "504", "505", "1296", "633", "1263", "507", "509", "510", "634", "654", "47", "1224", "1271", "1060", "516", "4201", "1015", "28", "517", "43", "4019", "518", "1327", "99", "1268", "520", "4203", "522", "531", "525", "1245", "511", "532", "534", "530", "53", "537", "535", "7800", "171", "195", "638", "4100", "2300", "469", "543", "922", "26", "539", "1286", "812", "538", "154", "1054", "637", "1192", "487", "508", "1304", "587", "485", "831", "65", "241", "536", "1066", "1274", "975", "521", "998", "944", "475", "1349", "1321", "978"]);
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
  const en = tidyEn(o.name?.en ?? cached?.name.en ?? (nd["name:en"] || (row.en ? titleCase(row.en) : "")));
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
    type: CITY_CBS_CODES.has(row.code) ? "city" : TOWN_CBS_CODES.has(row.code) ? "town" : "village",
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
