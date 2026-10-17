// A local address geocoder for the north over OpenStreetMap's own address data: house numbers,
// named streets, named industrial zones and junctions, fetched once from Overpass (in tiles,
// cached) and searched offline. Never Google, never a geocoding service, never a town centre.
// Data © OpenStreetMap contributors, ODbL.
//
// resolve({ town, address }) → { lat, lng, precision: "exact" | "near" | "street" | "area", ... }
// or { skip: why }. See the README for the rules.
import { cached, NORTH_BBOX, overpassQuery } from "./fetch.mjs";
import { km, normalize as placeNormalize } from "./places.mjs";

/** Tile edge in degrees: a whole-north query for every address is too big for Overpass. */
const TILE = 0.25;
/** "near": the nearest known number on the street may be this far from where we put the pin. */
export const NEAR_M = 200;
/** "street": a street's midpoint is used only when the whole named street is shorter. */
export const STREET_MAX_M = 700;
/** "area": a named industrial zone is used only when it is this small (its longest side). */
export const AREA_MAX_M = 1500;
/** How far from its town's centre an address may stand when OSM names no city for it. */
const TOWN_RADIUS_KM = { city: 6, town: 4, village: 2.5, neighbourhood: 2 };

/** The north's tiles, south-west corner first: [s, w, n, e]. */
export function tiles(bbox = NORTH_BBOX, size = TILE) {
  const [s, w, n, e] = bbox.split(",").map(Number);
  const out = [];
  for (let lat = s; lat < n - 1e-9; lat += size)
    for (let lng = w; lng < e - 1e-9; lng += size)
      out.push([lat, lng, Math.min(lat + size, n), Math.min(lng + size, e)].map(round6));
  return out;
}
const round6 = (n) => Math.round(n * 1e6) / 1e6;

/**
 * Compact address and street records for one tile, from Overpass:
 *   addresses: [lat, lng, street, housenumber, city]
 *   streets:   [name, nameHe, [[lat, lng], ...] per segment]
 */
async function fetchTile(t) {
  try {
    return await fetchTileOnce(t);
  } catch (error) {
    // Too much for the server at once: the tile's four quarters, each on its own.
    if (t[2] - t[0] < 0.06) throw error;
    console.warn(`tile ${t.join(",")} split in four (${error.message})`);
    const [s, w, n, e] = t;
    const mlat = round6((s + n) / 2);
    const mlng = round6((w + e) / 2);
    const out = { addresses: [], streets: [] };
    for (const q of [
      [s, w, mlat, mlng],
      [s, mlng, mlat, e],
      [mlat, w, n, mlng],
      [mlat, mlng, n, e],
    ]) {
      const part = await fetchTile(q);
      out.addresses.push(...part.addresses);
      out.streets.push(...part.streets);
    }
    return out;
  }
}

async function fetchTileOnce(t) {
  const box = t.join(",");
  const head = `[out:json][timeout:120][bbox:${box}];`;
  const elements = [
    ...(await overpassQuery(
      `addresses ${box}`,
      `${head}\nnwr["addr:housenumber"];\nout center tags;`,
      3,
    )),
    ...(await overpassQuery(
      `streets ${box}`,
      `${head}\n(way["highway"]["name"];way["highway"]["name:he"];);\nout tags geom;`,
      3,
    )),
  ];
  const addresses = [];
  const streets = [];
  for (const el of elements) {
    const tg = el.tags ?? {};
    if (tg["addr:housenumber"]) {
      const p = el.lat !== undefined ? el : el.center;
      if (!p) continue;
      const street = tg["addr:street:he"] ?? tg["addr:street"] ?? tg["addr:place"] ?? "";
      if (!street) continue;
      addresses.push([
        round6(p.lat),
        round6(p.lon),
        street,
        tg["addr:housenumber"],
        tg["addr:city:he"] ?? tg["addr:city"] ?? "",
      ]);
    } else if (el.type === "way" && el.geometry && (tg.name || tg["name:he"])) {
      streets.push([
        tg.name ?? "",
        tg["name:he"] ?? "",
        el.geometry.map((g) => [round6(g.lat), round6(g.lon)]),
      ]);
    }
  }
  return { addresses, streets };
}

/** Named industrial zones and junctions in the north: [kind, names[], lat, lng, sizeM]. */
async function fetchLandmarks() {
  const query = `[out:json][timeout:300][bbox:${NORTH_BBOX}];
(
  nwr["landuse"="industrial"]["name"];
  nwr["landuse"="industrial"]["name:he"];
  nwr["place"]["name"~"תעשי|תעסוק"];
  node["junction"]["name"];
  node["highway"~"traffic_signals|motorway_junction"]["name"];
  nwr["name"~"^(צומת|מחלף) "];
);
out tags center bb;`;
  const elements = await overpassQuery("landmarks", query);
  const out = [];
  for (const el of elements) {
    const tg = el.tags ?? {};
    const p = el.lat !== undefined ? el : el.center;
    if (!p) continue;
    const names = [tg.name, tg["name:he"], tg.alt_name, tg.old_name, tg.official_name].filter(
      Boolean,
    );
    const industrial = tg.landuse === "industrial" || /תעשי|תעסוק/.test(tg.name ?? "");
    const b = el.bounds;
    const size = b
      ? Math.max(
          km({ lat: b.minlat, lng: b.minlon }, { lat: b.maxlat, lng: b.minlon }),
          km({ lat: b.minlat, lng: b.minlon }, { lat: b.minlat, lng: b.maxlon }),
        ) * 1000
      : 0;
    out.push([industrial ? "industrial" : "junction", names, round6(p.lat), round6(p.lon), size]);
  }
  return out;
}

/** Every address, street and landmark in the north, cached as `geo-*.json` under .cache/. */
export async function loadOsmAddresses() {
  const addresses = [];
  const streets = [];
  for (const t of tiles()) {
    const data = await cached(`geo-tile-${t.join("_")}.json`, () => fetchTile(t));
    addresses.push(...data.addresses);
    streets.push(...data.streets);
  }
  const landmarks = await cached("geo-landmarks.json", fetchLandmarks);
  return { addresses, streets, landmarks };
}

// --- Normalisation -------------------------------------------------------------------------

/** Words before a street's name that say it is a street ("שדרות" before "שד", longest first). */
const STREET_PREFIX = /^(רחוב|רח|שדרות|שדרת|שד|דרך|סמטת|סמ|כיכר|ככר|משעול|שביל|שכונת|שכ)(?:\s|$)/;
const FINALS = { ך: "כ", ם: "מ", ן: "נ", ף: "פ", ץ: "צ" };

/**
 * A street name's comparison key: no prefix (רחוב / רח' / שד' / שדרות / דרך / סמטת), no quotes
 * or gershayim, dots, hyphens and maqaf as spaces, ק as כ, ט as ת, doubled vav and yod as one,
 * final letters as their normal form. "רח' יהודה הלוי" and "יהודה הלוי" meet.
 */
export function streetKey(name) {
  let s = String(name ?? "")
    .normalize("NFKD")
    .replace(/[֑-ׇ]/g, "")
    .replace(/[׳״'"`’]/g, "")
    .replace(/[.,]/g, " ")
    .replace(/[-־‐-―_/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // "דרך" alone before one word is the name ("דרך הים" stays "דרך הים" only via the loose key).
  for (let i = 0; i < 2; i++) {
    const m = s.match(STREET_PREFIX);
    if (!m || s.length === m[0].length) break;
    s = s.slice(m[0].length).trim();
  }
  return s
    .replace(/[ךםןףץ]/g, (c) => FINALS[c])
    .replace(/ק/g, "כ")
    .replace(/ט/g, "ת")
    .replace(/יי+/g, "י")
    .replace(/וו+/g, "ו")
    .toLowerCase();
}

/**
 * Looser still, for a second try when the exact key finds nothing: no article ה on a long
 * word, no vowel letters (א ו י) inside a word. "השיש" and "שיש", "הלוי" and "הלווי" meet.
 */
export function looseStreetKey(name) {
  return streetKey(name)
    .split(" ")
    .map((w) => (w.length > 3 && w.startsWith("ה") ? w.slice(1) : w))
    .map((w) => w[0] + w.slice(1).replace(/[אוי]/g, ""))
    .join(" ");
}

/** "12א" → 12, "12-14" → 12, "12/3" → 12; none → null. */
export function houseNumber(raw) {
  const m = String(raw ?? "").match(/\d+/);
  return m ? Number(m[0]) : null;
}

/** The ways the register writes "industrial zone", each replaced by one marker. */
const INDUSTRIAL =
  /(פארק\s+(?:ה)?תעשי(?:י)?(?:ה|ות)|קרי(?:י)?ת\s+(?:ה)?תעשי(?:י)?ה|אזור\s+(?:ה)?תעשי(?:י)?ה|אזה"?\s*ת|א\.?\s*תעשי(?:י)?ה|א\s*"\s*ת|א\.\s*ת\.?|(?<![א-ת])א\s+ת(?![א-ת]))/g;
const MARK = " § ";
/** Words that are not a street ("בית פרטי", "כביש ראשי", "חלקה", "מבנה"). */
const NOT_STREET =
  /^(כביש|ת|ד|ש|רח|רחוב|שד|דרך|בית פרטי|בית|חלקה|מבנה|ביתן|גוש|ליד|מול|כניסה|כניסה ראשית|מרכז|כביש ראשי)$/;

/**
 * What the register's free-text `ktovet` holds: { street, number, industrial, areaName,
 * junction }. PO boxes ("ת.ד. 524"), private bags ("ד.נ. גליל תחתון"), plots ("גוש 18764 חלקה
 * 31") and the town's own name are noise.
 */
export function parseAddress(raw, town = "") {
  let s = ` ${String(raw ?? "")} `
    .replace(/[־‐-―]/g, "-")
    .replace(/[׳`’]/g, "'")
    .replace(/״/g, '"')
    .replace(/\\/g, "/");
  s = s
    .replace(/(^|[\s,.])(ת\s*\.?\s*ד\s*'?\s*\.?|ת"ד|תד'?)\s*'?\.?\s*\d+/g, " ")
    .replace(/(^|[\s,.])(ת\s*\.?\s*ד\s*\.?)(?=\s|$)/g, " ")
    .replace(/(^|[\s,.])(ד\s*\.?\s*נ\s*\.?|ד"נ)\s*[^\d,]*/g, " ")
    .replace(/(^|\s)דאר\s+\S+/g, " ")
    .replace(/(^|\s)גוש\s*\d+/g, " ")
    .replace(/(^|\s)(חלקה|ח')\s*[\d/]+/g, " ")
    .replace(/(^|\s)מיקוד\s*\d+/g, " ")
    .replace(/(^|\s)(מבנה|ביתן)\s*\d+/g, " ")
    .replace(/([א-ת])(\d)/g, "$1 $2")
    .replace(/\*/g, " ");
  if (town) {
    const t = town.replace(/\*/g, "").trim();
    if (t.length >= 3) s = s.split(t).join(" ");
  }
  const industrial = INDUSTRIAL.test(s);
  INDUSTRIAL.lastIndex = 0;
  s = s.replace(INDUSTRIAL, MARK);
  // The zone's own name or side: what follows the marker up to a number, a comma or "ליד".
  let areaName = null;
  const after = s.match(/§\s*([^§\d,]*)/);
  if (after) {
    const words = after[1]
      .replace(/(ליד|על יד|מול|פינת)\s.*$/, "")
      .replace(/[.'"]/g, " ")
      .split(/\s+/)
      .filter((w) => w && !/^(רח|רחוב|ת|ד)$/.test(w));
    // Only a side ("דרומי", "ג'", "ישן") or a short proper name; a street after it is a street.
    if (words.length && words.length <= 3 && !/^(רח|רחוב)/.test(after[1].trim()))
      areaName = words.join(" ");
  }
  const junction = s.match(/צומת\s+([^\d,§]+)/);
  let street = null;
  let number = null;
  // Each piece between markers and commas: "רח' העוצמה 11", "השיש 18", "דרך י. סימון 52".
  for (const piece of s.split(/[§,]/)) {
    const m = piece.match(/([א-ת"'][א-ת"'.\s]*?)\s+(\d+)\s*([א-ת](?=\s|$))?/);
    if (m) {
      const cand = cleanStreet(m[1]);
      if (cand) {
        street = cand;
        number = Number(m[2]);
        break;
      }
    }
  }
  if (!street) {
    for (const piece of s.split(/[§,]/)) {
      // A street without a number ("רח יהודה הלוי", "רחוב אלמדינה", "שדרות אבא חושי").
      const n = piece.match(/(?:^|\s)(רחוב|רח'?\.?|שדרות|שד'?\.?|סמטת|דרך)\s*([א-ת"'][א-ת"'\s.]+)/);
      if (n) {
        const cand = cleanStreet(`${n[1]} ${n[2]}`);
        if (cand) {
          street = cand;
          break;
        }
      }
    }
  }
  return {
    street,
    number,
    industrial,
    areaName: areaName && areaName !== "ה" ? areaName : null,
    junction: junction ? junction[1].trim() : null,
  };
}

function cleanStreet(raw) {
  // "עילית רח' פניקס צבי": a street prefix inside the text starts the street.
  const inner = raw.match(/\s(רחוב|רח'|רח|שדרות|שד')\s/);
  if (inner) raw = raw.slice(inner.index + 1);
  const s = raw
    .replace(/\s+(ליד|על יד|מול|פינת)(\s.*)?$/, "")
    .replace(/^[\s.,'-]+|[\s.,'-]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const key = streetKey(s);
  if (!key || key.length < 2 || NOT_STREET.test(key) || /^צומת/.test(key)) return null;
  return s;
}

// --- The index -----------------------------------------------------------------------------

const metres = (a, b) => km(a, b) * 1000;

/** Total length of a street's segments (several ways under one name), in metres. */
function lengthM(segments) {
  let total = 0;
  for (const seg of segments)
    for (let i = 1; i < seg.length; i++)
      total += metres(
        { lat: seg[i - 1][0], lng: seg[i - 1][1] },
        { lat: seg[i][0], lng: seg[i][1] },
      );
  return total;
}

/** The point halfway along a street's longest connected piece. */
function midpoint(segments) {
  const seg = [...segments].sort((a, b) => lengthM([b]) - lengthM([a]))[0];
  const half = lengthM([seg]) / 2;
  let walked = 0;
  for (let i = 1; i < seg.length; i++) {
    const a = { lat: seg[i - 1][0], lng: seg[i - 1][1] };
    const b = { lat: seg[i][0], lng: seg[i][1] };
    const d = metres(a, b);
    if (walked + d >= half) {
      const f = d ? (half - walked) / d : 0;
      return { lat: a.lat + (b.lat - a.lat) * f, lng: a.lng + (b.lng - a.lng) * f };
    }
    walked += d;
  }
  return { lat: seg[0][0], lng: seg[0][1] };
}

/** Bounding size of a set of segments (longest side), metres: two far-apart streets of one name. */
function spanM(segments) {
  const pts = segments.flat();
  const lats = pts.map((p) => p[0]);
  const lngs = pts.map((p) => p[1]);
  const s = Math.min(...lats);
  const n = Math.max(...lats);
  const w = Math.min(...lngs);
  const e = Math.max(...lngs);
  return Math.max(
    metres({ lat: s, lng: w }, { lat: n, lng: w }),
    metres({ lat: s, lng: w }, { lat: s, lng: e }),
  );
}

/**
 * Builds the geocoder over compact OSM data and a place matcher (places.mjs). Each address and
 * street belongs to a Darb place: its addr:city when that names one near it, else the nearest
 * settlement within the town's radius.
 */
export function createGeocoder({ addresses, streets, landmarks = [] }, matcher) {
  const townOf = (lat, lng, city) => {
    if (city) {
      const m = matcher.match({ town: city, lat, lng });
      if (m?.place && m.how === "name") return m.place.slug;
    }
    const near = matcher.nearest({ lat, lng }, TOWN_RADIUS_KM.city);
    if (!near) return null;
    const r = TOWN_RADIUS_KM[near.place.type] ?? 2;
    return near.km <= r ? near.place.slug : null;
  };
  /** town → streetKey → [{ lat, lng, n, named }] */
  const points = new Map();
  /** streetKey → [{ lat, lng, n, town }] for addresses OSM gives no city to (town by distance). */
  for (const [lat, lng, street, num, city] of addresses) {
    const town = townOf(lat, lng, city);
    if (!town) continue;
    const key = streetKey(street);
    const n = houseNumber(num);
    if (!key || n === null) continue;
    const byStreet = points.get(town) ?? new Map();
    const list = byStreet.get(key) ?? [];
    list.push({ lat, lng, n, raw: num, named: Boolean(city) });
    byStreet.set(key, list);
    points.set(town, byStreet);
  }
  /** town → streetKey → segments */
  const ways = new Map();
  for (const [name, nameHe, geom] of streets) {
    if (!geom?.length) continue;
    const mid = geom[Math.floor(geom.length / 2)];
    const town = townOf(mid[0], mid[1], "");
    if (!town) continue;
    for (const n of new Set([nameHe, name].filter((x) => /[א-ת]/.test(x)))) {
      const key = streetKey(n);
      if (!key) continue;
      const byStreet = ways.get(town) ?? new Map();
      byStreet.set(key, [...(byStreet.get(key) ?? []), geom]);
      ways.set(town, byStreet);
    }
  }
  /** Landmarks with their town. */
  const marks = landmarks.map(([kind, names, lat, lng, size]) => ({
    kind,
    keys: names.map((n) => landmarkKey(n)),
    lat,
    lng,
    size,
    town: townOf(lat, lng, ""),
  }));

  /** The street's entries in a town: an exact key, else one key that differs only by "ה". */
  function streetIn(map, town, key) {
    const byStreet = map.get(town);
    if (!byStreet) return null;
    if (byStreet.has(key)) return byStreet.get(key);
    return null;
  }

  /** Neighbours of the town (a Haifa garage's address may sit across the Nesher line). */
  function townsFor(slug) {
    const p = matcher.bySlug.get(slug);
    if (!p) return [slug];
    return [slug];
  }

  function atNumber(list, number) {
    const exact = list.filter((x) => x.n === number);
    if (exact.length) {
      // One building can carry its number on several nodes: they must stand together.
      const c = centroid(exact);
      if (exact.every((x) => metres(x, c) <= 60))
        return { ...c, precision: "exact", matched: exact[0].raw };
    }
    // Same parity first (Israeli streets number one side odd, the other even).
    const below = list.filter((x) => x.n < number).sort((a, b) => b.n - a.n);
    const above = list.filter((x) => x.n > number).sort((a, b) => a.n - b.n);
    const side = (arr) => arr.find((x) => x.n % 2 === number % 2) ?? arr[0];
    const lo = side(below);
    const hi = side(above);
    if (lo && hi && metres(lo, hi) <= 2 * NEAR_M) {
      const f = (number - lo.n) / (hi.n - lo.n);
      return {
        lat: round6(lo.lat + (hi.lat - lo.lat) * f),
        lng: round6(lo.lng + (hi.lng - lo.lng) * f),
        precision: "near",
        matched: `${lo.raw}-${hi.raw}`,
      };
    }
    // One side known: the nearest number, when it is close in numbering (a few houses away).
    const one = [lo, hi]
      .filter(Boolean)
      .sort((a, b) => Math.abs(a.n - number) - Math.abs(b.n - number))[0];
    if (one && Math.abs(one.n - number) <= 10) {
      // Its distance to the rest of the street says how far apart numbers stand here.
      return { lat: one.lat, lng: one.lng, precision: "near", matched: String(one.raw) };
    }
    return null;
  }

  function onStreet(town, street, number) {
    const key = streetKey(street);
    if (!key) return { skip: "no street in the address" };
    const list = streetIn(points, town, key);
    if (list && number !== null) {
      const hit = atNumber(list, number);
      if (hit) return hit;
    }
    const segs = streetIn(ways, town, key);
    if (segs) {
      const len = lengthM(segs);
      if (len < STREET_MAX_M && spanM(segs) < STREET_MAX_M) {
        const mid = midpoint(segs);
        return { lat: round6(mid.lat), lng: round6(mid.lng), precision: "street", matched: street };
      }
      return { skip: `street longer than ${STREET_MAX_M} m and its number not on the map` };
    }
    if (list) return { skip: "number not on the map and the street has no geometry" };
    return { skip: "street not on the map in this town" };
  }

  function atLandmark(town, kind, name) {
    const inTown = marks.filter((m) => m.kind === kind && m.town === town);
    let found = inTown;
    if (name) {
      const key = landmarkKey(name);
      found = inTown.filter((m) => m.keys.some((k) => k && (k.includes(key) || key.includes(k))));
    }
    if (found.length !== 1) {
      return {
        skip: found.length
          ? `${found.length} ${kind === "industrial" ? "industrial zones" : "junctions"} in town`
          : `no ${kind === "industrial" ? "industrial zone" : "junction"} on the map`,
      };
    }
    const [m] = found;
    if (kind === "industrial" && m.size > AREA_MAX_M)
      return { skip: `industrial zone larger than ${AREA_MAX_M} m` };
    return { lat: m.lat, lng: m.lng, precision: "area", matched: m.keys[0] };
  }

  /**
   * One register address in its town. Tries the street (exact, near, street), then a named
   * industrial zone or junction. Never a town centre.
   */
  function resolve({ town, address }) {
    const slug = typeof town === "string" ? town : town?.slug;
    if (!slug) return { skip: "town not a Darb place" };
    const a = parseAddress(address);
    let streetMiss = null;
    if (a.street) {
      for (const t of townsFor(slug)) {
        const hit = onStreet(t, a.street, a.number);
        if (!hit.skip) return { ...hit, parsed: a };
        streetMiss = streetMiss ?? hit;
      }
    }
    if (a.junction) {
      const hit = atLandmark(slug, "junction", a.junction);
      if (!hit.skip) return { ...hit, parsed: a };
    }
    if (a.industrial) {
      const hit = atLandmark(slug, "industrial", a.areaName);
      if (!hit.skip) return { ...hit, parsed: a };
      if (!streetMiss) return { ...hit, parsed: a };
    }
    if (streetMiss) return { ...streetMiss, parsed: a };
    return { skip: "no street, zone or junction in the address", parsed: a };
  }

  return { resolve, parseAddress, stats: { towns: points.size, streetTowns: ways.size } };
}

/** A landmark name's key: no "צומת"/"אזור תעשייה" words, loose letters. */
export function landmarkKey(name) {
  return placeNormalize(
    String(name ?? "")
      .replace(/(צומת|מחלף|אזור|פארק|קרית|קריית|ה?תעשי[יה]+|ה?תעסוקה|א\.?ת\.?)/g, " ")
      .replace(/\s+/g, " "),
  )
    .replace(/[אוי\s]/g, "")
    .trim();
}

function centroid(list) {
  return {
    lat: round6(list.reduce((s, x) => s + x.lat, 0) / list.length),
    lng: round6(list.reduce((s, x) => s + x.lng, 0) / list.length),
  };
}
