// Darb's places for the importers: which district a place is in, and the best Darb place for a
// source record's town name and point. Generalises what was done by hand for the Paz stations.
import { readFileSync } from "node:fs";

export const NORTH = new Set(["northern-district", "haifa-district"]);
/** Settlement types a business can belong to (a district or the country is never its place). */
const SETTLEMENTS = new Set(["city", "town", "village", "neighbourhood"]);
/** How far the nearest settlement may be when the town name gives no match. */
export const NEAREST_KM = 6;
/** A name match farther than this from the record's point is not trusted. */
const NAME_MAX_KM = 15;
const TYPE_RANK = { city: 0, town: 1, village: 2, neighbourhood: 3 };

/**
 * Town names the sources use that are not a Darb place's name: junctions, old names and
 * neighbourhoods known by their own name. Normalised like every other name before lookup.
 */
export const TOWN_ALIASES = {
  כורדני: "kiryat-motzkin",
  "נצרת עילית": "nof-hagalil",
  "קרית חיים": "kiryat-haim",
  // Too short for the loose match ("גש"), so written out.
  "ג'יש": "jish-gush-halav",
};

export function loadDarbPlaces() {
  return JSON.parse(readFileSync(new URL("../../data/places.json", import.meta.url), "utf8"));
}

export function km(a, b) {
  const r = Math.PI / 180;
  const x = (b.lng - a.lng) * r * Math.cos(((a.lat + b.lat) / 2) * r);
  return Math.hypot(x, (b.lat - a.lat) * r) * 6371;
}

const FINALS = { ך: "כ", ם: "מ", ן: "נ", ף: "פ", ץ: "צ" };
/** Words that only say what kind of settlement it is ("kibbutz Ifat", "Kafr Iksal"). */
const SETTLEMENT_WORDS = new Set(
  ["כפר", "קיבוץ", "מושב", "מושבה", "ישוב", "יישוב", "עיר", "שיתופי", "קהילתי", "כפרי"].map((w) =>
    normalize(w),
  ),
);

/**
 * A Hebrew name's comparison key: no niqqud, punctuation or geresh, final letters as their
 * normal form, ק as כ, doubled yod and vav collapsed, so קריית and קרית, ג'יש and גיש meet.
 * Latin names (the CBS English aliases) are lower-cased and stripped the same way.
 */
export function normalize(name) {
  return String(name)
    .normalize("NFKD")
    .replace(/[֑-ׇ̀-ͯ]/g, "")
    .replace(/[׳״'"`’.]/g, "")
    .replace(/[-־‐-―_/,]/g, " ")
    .replace(/[ךםןףץ]/g, (c) => FINALS[c])
    .replace(/ק/g, "כ")
    .replace(/יי+/g, "י")
    .replace(/וו+/g, "ו")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Looser still: no matres lectionis (א ו י), no spaces, final ה and א the same. */
export function loose(name) {
  return normalize(name)
    .replace(/(^|\s)ה(?=\S{3})/g, "$1")
    .replace(/[הא](?=\s|$)/g, "ה")
    .replace(/ט/g, "ת")
    .replace(/[אוי\s]/g, "")
    .replace(/[aeiouy\s]/g, "");
}

/** Every way a name may be written: as is, without parentheses, inside them, without "kibbutz". */
export function variants(name) {
  const out = new Set();
  const base = String(name).trim();
  if (!base) return [];
  const add = (s) => {
    const n = normalize(s);
    if (!n) return;
    out.add(n);
    const words = n.split(" ");
    if (words.length > 1 && SETTLEMENT_WORDS.has(words[0])) out.add(words.slice(1).join(" "));
    if (words.length > 1) out.add([...words].sort().join(" "));
  };
  add(base);
  add(base.replace(/\([^)]*\)/g, " "));
  // "(קיבוץ)" only says what the place is; "(בוקייעה)" is another name for it.
  for (const m of base.matchAll(/\(([^)]*)\)/g))
    if (
      !normalize(m[1])
        .split(" ")
        .every((w) => SETTLEMENT_WORDS.has(w))
    )
      add(m[1]);
  return [...out];
}

/** The district a place belongs to, following its parent chain (null outside any district). */
export function districtOf(slug, bySlug) {
  for (let p = bySlug.get(slug); p; p = p.parent ? bySlug.get(p.parent) : undefined)
    if (p.type === "region") return p.slug;
  return null;
}

/**
 * A matcher over Darb's places. match({ town, names, lat, lng }) returns
 * { place, how: "name" | "nearest", km } or null: first a town-name match (exact, then loose)
 * near the point, else the nearest settlement within 6 km.
 */
export function createPlaceMatcher(places = loadDarbPlaces()) {
  const bySlug = new Map(places.map((p) => [p.slug, p]));
  const settlements = places.filter((p) => SETTLEMENTS.has(p.type));
  const exact = new Map();
  const looseIndex = new Map();
  // Each key lists its places with how strongly the key names them: a place's own name (2)
  // over one part of a hyphenated name (1).
  const index = (key, p, map, strength) => {
    if (!key) return;
    const list = map.get(key) ?? [];
    const had = list.find((x) => x.place === p);
    if (had) had.strength = Math.max(had.strength, strength);
    else list.push({ place: p, strength });
    map.set(key, list);
  };
  for (const p of settlements) {
    const names = [p.name.he, p.name.en, ...(p.aliases ?? [])].filter(Boolean);
    // "בנימינה-גבעת עדה" is also written "בנימינה": each hyphenated part names the place too.
    const parts = names.flatMap((n) => (/[-\u05BE]/.test(n) ? n.split(/\s*[-\u05BE]\s*/) : []));
    for (const [list, strength] of [
      [names, 2],
      [parts, 1],
    ])
      for (const name of list)
        for (const v of variants(name)) {
          index(v, p, exact, strength);
          index(loose(v), p, looseIndex, strength);
        }
  }
  for (const [alias, slug] of Object.entries(TOWN_ALIASES)) {
    const p = bySlug.get(slug);
    if (p) exact.set(normalize(alias), [{ place: p, strength: 3 }]);
  }

  const district = (slug) => districtOf(slug, bySlug);
  const inNorth = (slug) => NORTH.has(district(slug));

  /**
   * Without a point, a name is trusted when one place answers it most strongly: its own name over
   * a part of another's, then a city or town over a village ("טמרה" is the city, not the village
   * "טמרה (יזרעאל)").
   */
  function pick(found) {
    const top = Math.max(...found.map((x) => x.strength));
    let best = found.filter((x) => x.strength === top);
    if (best.length > 1) {
      const rank = Math.min(...best.map((x) => TYPE_RANK[x.place.type] ?? 9));
      best = best.filter((x) => (TYPE_RANK[x.place.type] ?? 9) === rank);
    }
    return best.length === 1 ? best[0].place : null;
  }

  function byName(names, point) {
    for (const map of [exact, looseIndex]) {
      const key = map === exact ? (v) => v : loose;
      for (const name of names) {
        for (const v of variants(String(name).replace(/\*/g, ""))) {
          // A loose key of two letters ("עלי" is "על") names too many places to trust.
          if (map === looseIndex && key(v).length < 3) continue;
          const found = map.get(key(v));
          if (!found?.length) continue;
          if (!point) {
            const place = pick(found);
            if (place) return { place, km: null };
            continue;
          }
          const best = found
            .map(({ place }) => ({ place, km: km(place, point) }))
            .sort((a, b) => a.km - b.km)[0];
          if (best.km <= NAME_MAX_KM) return best;
        }
      }
    }
    return null;
  }

  /** Every place a name could mean, exactly or loosely. */
  function namedBy(name) {
    const out = new Set();
    for (const v of variants(String(name).replace(/\*/g, ""))) {
      for (const x of exact.get(v) ?? []) out.add(x.place);
      if (loose(v).length >= 3) for (const x of looseIndex.get(loose(v)) ?? []) out.add(x.place);
    }
    return [...out];
  }

  function nearest(point, maxKm = NEAREST_KM) {
    let best = null;
    for (const p of settlements) {
      if (p.type === "neighbourhood") continue;
      const d = km(p, point);
      if (d <= maxKm && (!best || d < best.km)) best = { place: p, km: d };
    }
    return best;
  }

  /**
   * `town` and `names` are tried in order; `lat`/`lng` check the name and allow nearest. When the
   * town alone names one place but the point is more than 15 km from it, the source contradicts
   * itself: the result is { place: null, how: "conflict", town, km } and the record is skipped.
   */
  function match({ town, names = [], lat, lng } = {}) {
    const point = Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
    if (point && town) {
      const alone = byName([town], null);
      if (alone && namedBy(town).every((p) => km(p, point) > NAME_MAX_KM))
        return {
          place: null,
          how: "conflict",
          town: alone.place,
          km: round(km(alone.place, point)),
        };
    }
    const tried = [town, ...names].filter(Boolean);
    const named = byName(tried, point);
    if (named) return { place: named.place, how: "name", km: round(named.km) };
    if (!point) return null;
    const near = nearest(point);
    return near ? { place: near.place, how: "nearest", km: round(near.km) } : null;
  }

  return { match, nearest, district, inNorth, bySlug, settlements };
}

const round = (n) => (n === null ? null : Math.round(n * 1000) / 1000);
