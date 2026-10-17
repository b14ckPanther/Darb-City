// Kindergartens, daycare centres and schools in the north from the Education Ministry's list of
// institutions ("מוסדות חינוך"), which gives each one's official symbol, town and a point on the
// Israeli grid. Only points the ministry places by street address are used (precision high or
// very high); a point at a town's centre is not a kindergarten's door. Family daycares
// (משפחתון) are homes, so they are left out. OpenStreetMap's schools are not imported (the
// ministry lists every recognised one); one at the same spot under a similar name lends the
// school its Arabic and English names.
// Run: node packages/seed/scripts/import/edu.mjs [--refresh]
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { dedupe, similarNames } from "./dedupe.mjs";
import { assignSlugs, business, readListings, slugBase, writeListing } from "./emit.mjs";
import { datastore, today } from "./fetch.mjs";
import { itmToWgs84 } from "./itm.mjs";
import { KIND_INFO } from "./kind-map.mjs";
import { createNamer, plainDashes } from "./names.mjs";
import { BUSINESS_WORDS, HALAL, SECTOR_ACCENT, taglineFor } from "./osm-allkinds.mjs";
import { createPlaceMatcher, km } from "./places.mjs";
import { overpassTiles } from "./overpass-tiles.mjs";
import { ALL_KINDS_QUERY } from "./osm-query.mjs";

export const FILE = "edu-north.json";
export const RESOURCE = "2055063b-93e8-4d6a-b2c5-c253d18c0cf6";

/** The ministry's types Darb lists, and the kind each one is. */
export const TYPES = {
  "גן ילדים": "kindergartens",
  "מעון יום": "daycare",
  "בית ספר": "schools",
  'בי"ס כנסייתי': "schools",
  'בי"ס חקלאי': "schools",
  'בי"ס קיבוצי': "schools",
  'בי"ס מושבי': "schools",
  'בי"ס תורני': "schools",
  "ישיבה תיכונית": "schools",
  "ישיבה קטנה": "schools",
  אולפנה: "schools",
  "תלמוד תורה": "schools",
};
const PRECISE = new Set(["גבוהה מאוד", "גבוהה"]);

const L = (he, ar, en) => ({ he, ar, en });
const LABEL = {
  symbol: L("סמל מוסד", "رمز المؤسسة", "Ministry symbol"),
  supervision: L("פיקוח", "إشراف", "Supervision"),
  special: L("חינוך מיוחד", "تربية خاصة", "Special education"),
  cta: L("ניווט לגן", "خذني للروضة", "Navigate there"),
  schoolCta: L("ניווט לבית הספר", "خذني للمدرسة", "Navigate there"),
};
const PRIMARY = L("יסודי", "ابتدائي", "Primary");
const MIDDLE = L("חטיבת ביניים", "إعدادي", "Middle school");
const HIGH = L("תיכון", "ثانوي", "High school");
/** The ministry's school stages, as the levels a school teaches. */
const STAGES = {
  "יסודי בלבד": [PRIMARY],
  'חט"ב בלבד': [MIDDLE],
  "עליונה בלבד": [HIGH],
  'יסודי וחט"ב': [PRIMARY, MIDDLE],
  'חט"ב עליונה': [MIDDLE, HIGH],
  'חט"ב + עליונה': [MIDDLE, HIGH],
  "יסודי ועליונה": [PRIMARY, HIGH],
  'יסודי חט"ב ועליונה': [PRIMARY, MIDDLE, HIGH],
};
/** What one school is, by its only level ("Primary school in Karmiel"). */
const ONE_LEVEL = new Map([
  [PRIMARY, L("בית ספר יסודי", "مدرسة ابتدائية", "Primary school")],
  [MIDDLE, L("חטיבת ביניים", "مدرسة إعدادية", "Middle school")],
  [HIGH, L("תיכון", "مدرسة ثانوية", "High school")],
]);
/** The ministry's own type, where it says more than "school". */
const SCHOOL_TYPE = {
  'בי"ס כנסייתי': L("בית ספר כנסייתי", "مدرسة أهلية مسيحية", "Church school"),
  'בי"ס חקלאי': L("בית ספר חקלאי", "مدرسة زراعية", "Agricultural school"),
  'בי"ס תורני': L("בית ספר תורני", "مدرسة توراتية", "Torah school"),
  "ישיבה תיכונית": L("ישיבה תיכונית", "يشيفا ثانوية", "High school yeshiva"),
  "ישיבה קטנה": L("ישיבה קטנה", "يشيفا صغيرة", "Yeshiva ketana"),
  אולפנה: L("אולפנה", "أولبانا", "Ulpana"),
  "תלמוד תורה": L("תלמוד תורה", "تلمود توراة", "Talmud Torah"),
};
const ARABIC_SECTORS = new Set(["ערבי", "דרוזי", "בדואי", "צרקסי"]);
const PUPILS = {
  בנים: L("בנים", "بنين", "Boys"),
  בנות: L("בנות", "بنات", "Girls"),
};
/** A bare school name starts with what the school is, by its type. */
const SCHOOL_PREFIX = {
  "ישיבה תיכונית": "ישיבת",
  "ישיבה קטנה": "ישיבת",
  אולפנה: "אולפנת",
  "תלמוד תורה": "תלמוד תורה",
};
/** Names that already say they are a school. */
const SCHOOL_WORD =
  /(^|\s)(בית ה?ספר|בית חינוך|קרית חינוך|תיכון|מקיף|חטיבת ביניים|חטיבה|יסודי|ישיבת|ישיבה|אולפנת|אולפנה|אולפנא|תלמוד תורה|מדרסת|מדרסה|גימנסיה|גמנסיה|אורט|עמל|חינוך מיוחד|כפר הנוער|כפר נוער|פנימיית)(\s|$)/;
/** The ministry's short forms, written out. */
const SCHOOL_SHORT = [
  [/(^|\s)ביה?"ס(?=\s|$)/g, "$1בית ספר"],
  [/(^|\s)חט"?ב(?=\s|$)/g, "$1חטיבת ביניים"],
  [/(^|\s)ת"ת(?=\s|$)/g, "$1תלמוד תורה"],
  [/(^|\s)ע"?ש(?=\s|$)/g, '$1ע"ש'],
  [/(^|\s)(מ"?מ"?ד|מ"ד)(?=[\s-]|$)/g, '$1ממ"ד'],
  [/(^|\s)חנ"?מ(?=\s|$)/g, "$1חינוך מיוחד"],
];
/** Words in school names, for their Arabic and English. */
const SCHOOL_WORDS = {
  "בית ספר": { ar: "مدرسة", en: "School", after: true },
  "בית הספר": { ar: "مدرسة", en: "School", after: true },
  "בית חינוך": { ar: "بيت تربية", en: "School", after: true },
  תיכון: { ar: "ثانوية", en: "High School", after: true },
  "תיכון מקיף": { ar: "مدرسة شاملة", en: "Comprehensive High School", after: true },
  מקיף: { ar: "مدرسة شاملة", en: "Comprehensive School", after: true },
  "חטיבת ביניים": { ar: "إعدادية", en: "Middle School", after: true },
  יסודי: { ar: "ابتدائية", en: "Primary School", after: true },
  ישיבה: { ar: "يشيفا", en: "Yeshiva" },
  "ישיבה תיכונית": { ar: "يشيفا ثانوية", en: "High School Yeshiva" },
  אולפנת: { ar: "أولبانا", en: "Ulpanat" },
  אולפנה: { ar: "أولبانا", en: "Ulpana" },
  "תלמוד תורה": { ar: "تلمود توراة", en: "Talmud Torah" },
  גימנסיה: { ar: "جمنازيا", en: "Gymnasium", after: true },
  גמנסיה: { ar: "جمنازيا", en: "Gymnasium", after: true },
  אורט: { ar: "أورط", en: "ORT" },
  'ממ"ד': { ar: "رسمية دينية", en: "State Religious", adj: true, enBefore: true },
  "חינוך מיוחד": { ar: "تربية خاصة", en: "Special Education", adj: true, enBefore: true },
  דמוקרטי: { ar: "ديمقراطية", en: "Democratic", adj: true, enBefore: true },
  אזורי: { ar: "إقليمية", en: "Regional", adj: true, enBefore: true },
  טכנולוגי: { ar: "تكنولوجية", en: "Technological", adj: true, enBefore: true },
  'ע"ש': { ar: "", en: "" },
  אבן: { ar: "ابن", en: "Ibn" },
};
const SUPERVISION = {
  ממלכתי: L("ממלכתי", "رسمي", "State"),
  "ממלכתי דתי": L("ממלכתי דתי", "رسمي ديني", "State religious"),
  חרדי: L("חרדי", "حريدي", "Haredi"),
};
const SECTOR_SAY = {
  ערבי: L("ערבי", "عربي", "Arab"),
  דרוזי: L("דרוזי", "درزي", "Druze"),
  בדואי: L("בדואי", "بدوي", "Bedouin"),
  צרקסי: L("צ'רקסי", "شركسي", "Circassian"),
};

/** "גן חרוב (מעיינות" is cut off in the list: its parenthesis is closed. */
const closeParens = (s) =>
  (s.match(/\(/g)?.length ?? 0) > (s.match(/\)/g)?.length ?? 0) ? `${s})` : s;

/**
 * "רעות-טבריה" in Tiberias is "רעות": the town's name at the end says nothing on its card. It
 * stays when the rest would only say what the school is ("יסודי א' שעב").
 */
function withoutTown(name, place) {
  const town = noParens(place.name.he);
  if (!town) return name;
  const re = new RegExp(`(?:\\s*-\\s*|\\s+)${escapeRe(town)}$`);
  const cut = name.replace(re, "").trim();
  const own = core(cut)
    .replace(/(^|\s)[א-ת]['׳"]?(?=\s|$)/g, " ")
    .replace(/[^א-ת]/g, "");
  return own.length >= 3 ? cut : name;
}
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const noParens = (s) =>
  String(s ?? "")
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .trim();
const ARABIC = /[\u0600-\u06FF]/;
const HEBREW = /[\u05D0-\u05EA]/;

/** A school's Hebrew name: short forms written out, its town dropped, its type in front. */
export function schoolName(raw, type, place) {
  let he = raw;
  for (const [re, to] of SCHOOL_SHORT) he = he.replace(re, to);
  he = withoutTown(he.replace(/\s+/g, " ").trim(), place);
  if (SCHOOL_WORD.test(he)) return he;
  return `${SCHOOL_PREFIX[type] ?? "בית ספר"} ${he}`;
}

/**
 * OSM schools near a point (within 150 m) under a similar Hebrew name: their own Arabic and
 * English names, in the right script, replace the letter-by-letter ones.
 */
function osmNames(osm, he, lat, lng) {
  let best = null;
  for (const o of osm) {
    const d = km({ lat, lng }, o) * 1000;
    if (d > 150 || (best && d >= best.d)) continue;
    const name = o.tags["name:he"] ?? (HEBREW.test(o.tags.name ?? "") ? o.tags.name : null);
    if (!name || !similarNames({ he: core(he) }, { he: core(name) })) continue;
    best = { d, o };
  }
  if (!best) return null;
  const t = best.o.tags;
  const ar = t["name:ar"] ?? (ARABIC.test(t.name ?? "") ? t.name : null);
  const en = t["name:en"];
  const out = {
    ...(ar && ARABIC.test(ar) ? { ar: plainDashes(ar) } : {}),
    ...(en && /^[\p{Script=Latin}\d\s'".,&()-]+$/u.test(en) ? { en: plainDashes(en) } : {}),
  };
  return Object.keys(out).length ? out : null;
}
/** A school name without the words every school name has, for matching. */
const core = (he) =>
  he
    .replace(
      /(^|\s)(בית ה?ספר|בי"ס|ביה"ס|תיכון|מקיף|יסודי|חטיבת ביניים|ממ"ד|ע"ש|ישיבת|אולפנת|תלמוד תורה|חינוך מיוחד)(?=\s|$)/g,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();

/** Pure, for fixtures: ministry rows (and OSM schools, for names) to listings. */
export function buildEdu({ rows, existing = [], taken = [], osmSchools = [] }) {
  const matcher = createPlaceMatcher();
  const namer = createNamer(undefined, {
    extraWords: {
      ...BUSINESS_WORDS,
      ...SCHOOL_WORDS,
      גן: { ar: "روضة", en: "Kindergarten", after: true },
      "גן ילדים": { ar: "روضة", en: "Kindergarten", after: true },
      "גן טיפולי": { ar: "روضة علاجية", en: "Therapeutic Kindergarten", after: true },
      "מעון יום": { ar: "حضانة", en: "Daycare", after: true },
    },
  });
  const counts = {
    fetched: rows.length,
    otherTypes: 0,
    familyDaycare: 0,
    imprecise: 0,
    outsideNorth: 0,
    pointFarFromTown: 0,
    halalWord: 0,
    osmNames: 0,
  };
  const businesses = [];
  for (const r of rows) {
    const kind = TYPES[r.TEUR_TAT_SUG_MISGERET];
    if (!kind) {
      counts.otherTypes++;
      continue;
    }
    const raw = plainDashes(r.SHEM_MOSAD ?? "").trim();
    if (!raw || /משפחתון/.test(raw)) {
      counts.familyDaycare++;
      continue;
    }
    if (!PRECISE.has(r.RAMAT_DIYUK_MIKUM) || !(r.X > 100000) || !(r.Y > 350000)) {
      counts.imprecise++;
      continue;
    }
    const { lat, lng } = itmToWgs84(r.X, r.Y);
    const m = matcher.match({ town: String(r.ISV_SHEM_ISHUV ?? "").trim(), lat, lng });
    if (m?.how === "conflict") {
      if (matcher.inNorth(m.town.slug)) counts.pointFarFromTown++;
      else counts.outsideNorth++;
      continue;
    }
    if (!m || !matcher.inNorth(m.place.slug)) {
      counts.outsideNorth++;
      continue;
    }
    const place = m.place;
    // "גן רעים" stays; a bare "רעים" reads as the kindergarten (or daycare) it is.
    const plain = closeParens(raw.replace(/\s*\(ע"ר\)\s*/g, " ").trim());
    const named = /^(גן|גני|מעון|פעוטון|תינוקי)/.test(plain);
    const school = kind === "schools";
    const he = school
      ? schoolName(plain, r.TEUR_TAT_SUG_MISGERET, place)
      : named
        ? plain
        : `${kind === "kindergartens" ? "גן" : "מעון"} ${plain}`;
    const fromOsm = school ? osmNames(osmSchools, he, lat, lng) : null;
    if (fromOsm) counts.osmNames++;
    // Used only to read the name: an Arab, Druze, Bedouin or Circassian school's Hebrew name is
    // its Arabic name in Hebrew letters. The card never says which community a school serves.
    const arabic = school && ARABIC_SECTORS.has(r.TEUR_MIGZAR);
    const name = { ...namer.name(he, place, { arabic }), ...fromOsm };
    // Darb never writes the word (a transliterated name can land on it).
    if (HALAL.test(JSON.stringify(name))) {
      counts.halalWord++;
      continue;
    }
    if (school) {
      const levels = STAGES[r.TEUR_SHLAV_HINUH] ?? [];
      const one = levels.length === 1 ? ONE_LEVEL.get(levels[0]) : KIND_INFO.schools.one;
      // A school's card says what it teaches and to whom, never which community it serves.
      const items = [
        ...levels.map((label) => ({ label })),
        ...(SCHOOL_TYPE[r.TEUR_TAT_SUG_MISGERET]
          ? [{ label: SCHOOL_TYPE[r.TEUR_TAT_SUG_MISGERET] }]
          : []),
        ...(r.TEUR_SUG_CHINUCH === "מיוחד" ? [{ label: LABEL.special }] : []),
        ...(PUPILS[r.TEUR_HERKEV_UCHLOSIYA] ? [{ label: PUPILS[r.TEUR_HERKEV_UCHLOSIYA] }] : []),
        ...(SUPERVISION[r.TEUR_PIKOH1]
          ? [{ label: LABEL.supervision, meta: SUPERVISION[r.TEUR_PIKOH1] }]
          : []),
        {
          label: LABEL.symbol,
          meta: L(`${r.SEMEL_MOSAD}`, `${r.SEMEL_MOSAD}`, `${r.SEMEL_MOSAD}`),
        },
      ];
      businesses.push(
        business({
          slug: slugBase("", name.en),
          place: place.slug,
          kinds: [kind],
          name,
          tagline: L(
            `${one.he} ב${noParens(place.name.he)}`,
            `${one.ar} في ${noParens(place.name.ar)}`,
            `${one.en} in ${noParens(place.name.en)}`,
          ),
          address: { he: place.name.he, ar: place.name.ar, en: place.name.en },
          lat,
          lng,
          attributes: { eduSymbol: Number(r.SEMEL_MOSAD) },
          screen: { title: one, items, cta: LABEL.schoolCta },
          accent: SECTOR_ACCENT.education,
        }),
      );
      continue;
    }
    const items = [
      { label: KIND_INFO[kind].one },
      { label: LABEL.symbol, meta: L(`${r.SEMEL_MOSAD}`, `${r.SEMEL_MOSAD}`, `${r.SEMEL_MOSAD}`) },
      ...(SUPERVISION[r.TEUR_PIKOH1]
        ? [{ label: LABEL.supervision, meta: SUPERVISION[r.TEUR_PIKOH1] }]
        : []),
      ...(SECTOR_SAY[r.TEUR_MIGZAR] ? [{ label: SECTOR_SAY[r.TEUR_MIGZAR] }] : []),
      ...(r.TEUR_SUG_CHINUCH === "מיוחד" ? [{ label: LABEL.special }] : []),
    ];
    businesses.push(
      business({
        slug: slugBase("", name.en),
        place: place.slug,
        kinds: [kind],
        name,
        tagline: taglineFor(kind, place),
        address: { he: place.name.he, ar: place.name.ar, en: place.name.en },
        lat,
        lng,
        attributes: { eduSymbol: Number(r.SEMEL_MOSAD) },
        screen: { title: KIND_INFO[kind].one, items, cta: LABEL.cta },
        accent: SECTOR_ACCENT.kids,
      }),
    );
  }
  counts.inNorth = businesses.length;
  // Two kindergartens in one building are two (their symbols differ); a twin elsewhere is not.
  // An OSM Islamic school is a ministry school too when they stand together under one name.
  const asSchools = existing.map((e) =>
    e.kinds?.includes("islamic-schools") ? { ...e, kinds: [...e.kinds, "schools"] } : e,
  );
  const { kept, dropped } = dedupe(businesses, { existing: asSchools, idKeys: ["eduSymbol"] });
  counts.deduped = dropped.length;
  // Slugs also step around the showroom's examples, which share places with real businesses.
  assignSlugs(kept, [...existing, ...taken]);
  counts.emitted = kept.length;
  return { businesses: kept, counts, dropped };
}

async function main() {
  const rows = await datastore(RESOURCE);
  const existing = readListings({ except: FILE });
  const taken = JSON.parse(
    readFileSync(new URL("../../data/businesses.json", import.meta.url), "utf8"),
  );
  // The all-kinds importer's cached tiles hold every named OSM school in the north.
  const osmSchools = (await overpassTiles("allkinds", ALL_KINDS_QUERY))
    .filter((e) => e.tags?.amenity === "school")
    .map((e) => ({ tags: e.tags, lat: e.lat ?? e.center?.lat, lng: e.lon ?? e.center?.lon }))
    .filter((e) => e.lat !== undefined && e.lng !== undefined);
  const { businesses, counts } = buildEdu({ rows, existing, taken, osmSchools });
  writeListing(
    FILE,
    {
      name: "משרד החינוך, מוסדות חינוך (data.gov.il)",
      url: "https://data.gov.il/dataset/mosdot_edu",
      resource: RESOURCE,
      licence: "data.gov.il, Other (Open), Ministry of Education",
      region: "northern-district, haifa-district",
      fetched: today(),
      points:
        "the ministry's own X/Y on the Israeli grid (ITM), converted to WGS84; only points placed by street address",
      left_out:
        "other institutions (hospital classes, gifted programmes, colleges, youth centres), family daycares (homes), points placed only at a town or neighbourhood centre; OSM schools (names only, where one stands within 150 m under a similar name)",
      hours: "none: the list gives no hours",
      counts,
    },
    businesses,
  );
  console.log(JSON.stringify(counts));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await main();
