// Licensed garages and vehicle testing stations in the north, from the Ministry of Transport's
// register ("מוסכים ומכוני רישוי"). The register has no coordinates. A garage's pin is, in turn:
// the garage itself on OpenStreetMap (same town, same name or phone), else its register address
// through the local OSM address geocoder (geocode.mjs: exact number, nearest number, a short
// street, a small named industrial zone or junction). Anything else is skipped and counted with
// why. Pins are never invented and never a town centre.
// Run: node packages/seed/scripts/import/garages.mjs [--refresh]
import { mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { dedupe } from "./dedupe.mjs";
import { business, slugBase, assignSlugs, readListings, writeListing } from "./emit.mjs";
import { datastore, overpass, pointOf, today } from "./fetch.mjs";
import { createGeocoder, loadOsmAddresses } from "./geocode.mjs";
import { createNamer, plainDashes, tradeName } from "./names.mjs";
import { OSM_ATTRIBUTION } from "./osm.mjs";
import { normalizePhone } from "./phones.mjs";
import { createPlaceMatcher, km, loose, normalize } from "./places.mjs";

export const FILE = "garages-north.json";
export const RESOURCE = "bb68386a-a331-4bbc-b668-bba2766d517d";
/** How far from its town's centre a garage's OSM twin may stand. */
const TOWN_KM = 5;
const TESTING_TYPE = 1;
const ACCENT = "#9fb86a";
const TESTING_ACCENT = "#5fb3a8";

/** The register's trades, by code, as items on the card. Unknown codes are left out. */
export const SPECIALTIES = {
  10: { he: "מכונאות בנזין", ar: "ميكانيك بنزين", en: "Petrol engines" },
  15: { he: "אוטוטק", ar: "أوتوتك", en: "Autotech" },
  20: { he: "מכונאות דיזל", ar: "ميكانيك ديزل", en: "Diesel engines" },
  21: { he: "משאיות ואוטובוסים", ar: "شاحنات وباصات", en: "Trucks and buses" },
  22: { he: 'רכב על גפ"מ', ar: "سيارات عالغاز", en: "LPG cars" },
  23: { he: "רכב חשמלי והיברידי", ar: "سيارات كهربا وهايبرد", en: "Electric and hybrid cars" },
  30: { he: "חשמל רכב", ar: "كهربا سيارات", en: "Auto electric" },
  33: { he: "מוסך מומחה", ar: "كراج مختص", en: "Specialist garage" },
  60: { he: "רדיאטורים", ar: "رادياتيرات", en: "Radiators" },
  70: { he: "פחחות", ar: "سمكرة", en: "Body work" },
  80: { he: "מסגרות רכב", ar: "حدادة سيارات", en: "Chassis work" },
  81: { he: "אגזוזים", ar: "إكزوزات", en: "Exhausts" },
  90: { he: "קפיצים", ar: "سوست", en: "Springs" },
  91: { he: "בלמים", ar: "فرامل", en: "Brakes" },
  100: { he: "צבע רכב", ar: "دهان سيارات", en: "Paintwork" },
  111: { he: "מערכות כיבוי ברכב", ar: "أنظمة إطفا بالسيارة", en: "Vehicle fire systems" },
  122: { he: "טכוגרפים", ar: "تاكوغراف", en: "Tachographs" },
  130: { he: "צמיגים", ar: "كاوتشوك", en: "Tyres" },
  135: { he: "צמיגים", ar: "كاوتشوك", en: "Tyres" },
  140: { he: "שיפוץ מנועים", ar: "تجديد مواتير", en: "Engine rebuilds" },
  142: { he: "שיפוץ מכללי חשמל", ar: "تصليح قطع كهربا", en: "Electrical parts rebuilds" },
  143: { he: "בלמים", ar: "فرامل", en: "Brakes" },
  144: { he: "מחוונים", ar: "عدادات", en: "Gauges" },
  145: { he: "קרבורטורים", ar: "كاربراتير", en: "Carburettors" },
  150: { he: "אופנועים וקטנועים", ar: "موتورات وسكوترات", en: "Motorbikes and scooters" },
  155: { he: "אופנועים וטרקטורונים", ar: "موتورات وتراكترونات", en: "Motorbikes and quads" },
  160: { he: "משאבות ומזרקי דיזל", ar: "مضخات وبخاخات ديزل", en: "Diesel pumps and injectors" },
  170: { he: "בדיקת עשן לדיזל", ar: "فحص دخان للديزل", en: "Diesel smoke test" },
  171: { he: "בדיקת עשן לדיזל", ar: "فحص دخان للديزل", en: "Diesel smoke test" },
  172: { he: "רישוי רכב", ar: "ترخيص سيارات", en: "Vehicle licensing" },
  173: { he: "רישוי רכב", ar: "ترخيص سيارات", en: "Vehicle licensing" },
  175: { he: "פחחות וצבע", ar: "سمكرة ودهان", en: "Body work and paint" },
  177: { he: "פחחות וצבע", ar: "سمكرة ودهان", en: "Body work and paint" },
  180: { he: "בדיקה לפני קנייה", ar: "فحص قبل الشرا", en: "Pre-purchase check" },
  181: { he: "טסט שנתי", ar: "تست سنوي", en: "Annual vehicle test" },
  182: { he: "רישוי רכב", ar: "ترخيص سيارات", en: "Vehicle licensing" },
  187: { he: "רישום רכב חדש", ar: "تسجيل سيارة جديدة", en: "New car registration" },
  188: { he: "רישוי רכב חדש", ar: "ترخيص سيارة جديدة", en: "New car licensing" },
  190: { he: "טרקטורים וכלים ניידים", ar: "تراكتورات ومعدات", en: "Tractors and machinery" },
  191: { he: "טרקטורונים", ar: "تراكترونات", en: "Quads" },
  192: { he: "רישוי ציוד חקלאי", ar: "ترخيص معدات زراعية", en: "Farm machinery licensing" },
  194: { he: "מלגזות", ar: "رافعات شوكية", en: "Forklifts" },
  195: { he: "מתלים וכיוון", ar: "تعليق وميزان", en: "Suspension and alignment" },
  202: { he: "חילוץ ותיקון בדרך", ar: "إنقاذ وتصليح عالطريق", en: "Roadside repairs" },
  205: { he: "מזגנים לרכב", ar: "مكيفات سيارات", en: "Car air conditioning" },
  206: { he: "תיבות הילוכים אוטומטיות", ar: "جيرات أوتوماتيك", en: "Automatic gearboxes" },
  207: { he: "תיבות הילוכים", ar: "جيرات", en: "Gearboxes" },
  300: { he: "בדיקה אחרי תאונה", ar: "فحص بعد حادث", en: "Post-accident check" },
  301: { he: "בדיקה אחרי תאונה", ar: "فحص بعد حادث", en: "Post-accident check" },
};
const TYRES = new Set([130, 135]);
const BODY = new Set([70, 80, 100, 175, 177]);

/** The register's types (cod_sug_mosah): what the card says the garage is, and its own item. */
export const TYPES = {
  1: { key: "testing", item: 181 },
  2: { key: "licensing", item: 188 },
  3: { key: "agricultural", item: 192 },
  4: { key: "licensing", item: 172 },
  5: { key: "licensing", item: 182 },
  6: { key: "garage" },
  7: { key: "agricultural", item: 188 },
  8: { key: "licensing", item: 188 },
};
/** What the coverage report calls each type. */
export const TYPE_NAMES = {
  testing: "Testing stations (מכון רישוי)",
  garage: "Licensed garages (מוסך מורשה)",
  licensing: "Licensing garages (מוסך רישוי)",
  agricultural: "Farm machinery licensing (ציוד חקלאי)",
  unknown: "Unknown type",
};

const GARAGE = { he: "מוסך מורשה", ar: "كراج مرخّص", en: "Licensed garage" };
const TESTING = { he: "מכון רישוי", ar: "مكان الترخيص", en: "Vehicle testing" };
const LICENSING = { he: "מוסך רישוי", ar: "كراج ترخيص", en: "Licensing garage" };
const AGRI = { he: "מוסך כלים חקלאיים", ar: "كراج معدات زراعية", en: "Farm machinery garage" };
const CTA_GARAGE = { he: "ניווט למוסך", ar: "خذني للكراج", en: "Navigate to the garage" };
const CTA_TESTING = { he: "ניווט למכון", ar: "خذني للتست", en: "Navigate to the testing station" };

/** Words in garage names, for the Arabic and English names (colloquial Arabic, never فصحى). */
export const GARAGE_WORDS = {
  מוסך: { ar: "كراج", en: "Garage", after: true },
  מוסכי: { ar: "كراجات", en: "Garages", after: true },
  "מכון רישוי": { ar: "مكان الترخيص", en: "Vehicle testing", after: true },
  "מכון טסט": { ar: "تست", en: "Vehicle testing", after: true },
  "מוסך רישוי": { ar: "كراج ترخيص", en: "Licensing garage", after: true },
  רישוי: { ar: "ترخيص", en: "Licensing", after: true },
  טסט: { ar: "تست", en: "Test" },
  "חשמל רכב": { ar: "كهربا سيارات", en: "Auto electric", after: true },
  "חשמלאות רכב": { ar: "كهربا سيارات", en: "Auto electric", after: true },
  חשמל: { ar: "كهربا", en: "Electric", after: true },
  פחחות: { ar: "سمكرة", en: "Body work", after: true },
  "פחחות וצבע": { ar: "سمكرة ودهان", en: "Body work and paint", after: true },
  צבע: { ar: "دهان", en: "Paint", after: true },
  צמיגי: { ar: "كاوتشوك", en: "Tyres", after: true },
  צמיגים: { ar: "كاوتشوك", en: "Tyres", after: true },
  פנצריה: { ar: "بنشرجي", en: "Tyre repair", after: true },
  מכונאות: { ar: "ميكانيك", en: "Mechanics", after: true },
  רכב: { ar: "سيارات", en: "Cars", after: true },
  הרכב: { ar: "السيارات", en: "Cars", after: true },
  "שירותי רכב": { ar: "خدمات سيارات", en: "Car Services", after: true },
  "שרותי רכב": { ar: "خدمات سيارات", en: "Car Services", after: true },
  שרות: { ar: "خدمة", en: "Service", after: true },
  שרותי: { ar: "خدمات", en: "Services", after: true },
  ובניו: { ar: "وأولاده", en: "and Sons", adj: true },
  בניו: { ar: "وأولاده", en: "and Sons", adj: true },
  ושות: { ar: "وشركاه", en: "and Co", adj: true },
  "ושות'": { ar: "وشركاه", en: "and Co", adj: true },
  אחים: { ar: "إخوان", en: "Brothers", adj: true },
  האחים: { ar: "الإخوان", en: "Brothers", after: true },
  מרכז: { ar: "مركز", en: "Centre", after: true },
  טרקטורים: { ar: "تراكتورات", en: "Tractors", after: true },
  מוטורס: { ar: "موتورز", en: "Motors" },
  מוטור: { ar: "موتور", en: "Motor" },
  אוטו: { ar: "أوتو", en: "Auto" },
  סרויס: { ar: "سيرفيس", en: "Service" },
  גראג: { ar: "كراج", en: "Garage" },
  "גראג'": { ar: "كراج", en: "Garage" },
  גלגל: { ar: "دولاب", en: "Wheel" },
  ספורט: { ar: "سبورت", en: "Sport" },
  טכנו: { ar: "تكنو", en: "Techno" },
  פיקס: { ar: "فيكس", en: "Fix" },
  קאר: { ar: "كار", en: "Car" },
  חוסיין: { ar: "حسين", en: "Hussein" },
  חסן: { ar: "حسن", en: "Hasan" },
  עלי: { ar: "علي", en: "Ali" },
  סאמי: { ar: "سامي", en: "Sami" },
  סמיר: { ar: "سمير", en: "Samir" },
  מחמוד: { ar: "محمود", en: "Mahmoud" },
  מוחמד: { ar: "محمد", en: "Mohammad" },
  מחמד: { ar: "محمد", en: "Mohammad" },
  יוסף: { ar: "يوسف", en: "Yosef" },
  איברהים: { ar: "إبراهيم", en: "Ibrahim" },
  אברהים: { ar: "إبراهيم", en: "Ibrahim" },
  "ח'ליל": { ar: "خليل", en: "Khalil" },
  כמאל: { ar: "كمال", en: "Kamal" },
  "ג'מיל": { ar: "جميل", en: "Jamil" },
  נביל: { ar: "نبيل", en: "Nabil" },
  סאלח: { ar: "صالح", en: "Saleh" },
  עבד: { ar: "عبد", en: "Abed" },
  "ח'אלד": { ar: "خالد", en: "Khaled" },
  חאלד: { ar: "خالد", en: "Khaled" },
  עומר: { ar: "عمر", en: "Omar" },
  מוסא: { ar: "موسى", en: "Musa" },
  עיסא: { ar: "عيسى", en: "Issa" },
  פאדי: { ar: "فادي", en: "Fadi" },
  ראמי: { ar: "رامي", en: "Rami" },
  ואיל: { ar: "وائل", en: "Wael" },
  באסם: { ar: "باسم", en: "Basem" },
  "ג'ורג'": { ar: "جورج", en: "George" },
  אליאס: { ar: "الياس", en: "Elias" },
  חנא: { ar: "حنا", en: "Hanna" },
  סלים: { ar: "سليم", en: "Salim" },
  נאסר: { ar: "ناصر", en: "Nasser" },
  נאצר: { ar: "ناصر", en: "Nasser" },
  מוסטפא: { ar: "مصطفى", en: "Mustafa" },
  מצטפא: { ar: "مصطفى", en: "Mustafa" },
  אמין: { ar: "أمين", en: "Amin" },
  חמוד: { ar: "حمود", en: "Hamud" },
  אחמד: { ar: "أحمد", en: "Ahmad" },
  אבו: { ar: "أبو", en: "Abu" },
  בן: { ar: "بن", en: "Ben" },
};

/** Words in a garage's name that say what it is, not which one. */
const GENERIC = new Set(
  [
    "מוסך",
    "המוסך",
    "מוסכי",
    "מוסכים",
    "מכון",
    "רישוי",
    "רכב",
    "הרכב",
    "טסט",
    "צמיגי",
    "צמיגים",
    "הצמיג",
    "פנצריה",
    "פנצריית",
    "ופנצריה",
    "שירות",
    "שרות",
    "שירותי",
    "שרותי",
    "מרכז",
    "פחחות",
    "חשמל",
    "מכונאות",
    "ושות",
    "ובניו",
    "בניו",
    "אש",
    "שלי",
  ].map((w) => loose(w)),
);

/** A name's distinctive Hebrew words, each in its loose form. */
export function nameWords(he) {
  return normalize(tradeName(he))
    .split(" ")
    .filter((w) => /[\u05D0-\u05EA]/.test(w))
    .map((w) => loose(w))
    .filter((w) => w.length >= 2 && !GENERIC.has(w));
}

const isHebrew = (s) => /[\u05D0-\u05EA]/.test(s ?? "");

/**
 * The OSM element that is this garage: in its town, with its phone, or with a Hebrew name whose
 * distinctive words all appear in the register's name ("מוסך אלמוג" is "יחיא יצחק - מוסך
 * אלמוג"). A name that is only a town's name says nothing.
 */
export function findOsmTwin(garage, place, osm, isPlaceName = () => false) {
  const want = new Set(nameWords(garage.name));
  const phones = new Set(garage.phones.filter(Boolean));
  const candidates = [];
  for (const el of osm) {
    const point = pointOf(el);
    if (km(place, point) > TOWN_KM) continue;
    const t = el.tags ?? {};
    const elPhone = normalizePhone(t.phone ?? t["contact:phone"]);
    if (elPhone && phones.has(elPhone)) {
      candidates.push({ el, point, how: "phone" });
      continue;
    }
    for (const n of [t["name:he"], t.name].filter(isHebrew)) {
      const words = nameWords(n);
      if (words.length === 0 || isPlaceName(words.join(" "))) continue;
      const exact = words.length === want.size && words.every((w) => want.has(w));
      // A short name ("מכון רישוי חן") must be the register's whole name, not a part of it.
      if (words.join("").length < 3 && !exact) continue;
      if (words.every((w) => want.has(w))) {
        candidates.push({ el, point, how: "name", exact: words.length === want.size });
        break;
      }
    }
  }
  // One answer only: two OSM garages answering one register entry is not a confident pin.
  const ids = new Set(candidates.map((c) => c.el.id));
  return ids.size === 1 ? candidates[0] : null;
}

/** A register name for the card: no legal tail ("בע מ", "בע ם"), Latin words title-cased. */
export function cleanName(he) {
  return tradeName(
    plainDashes(he)
      .replace(/(^|\s)בע\s*[מם](?=\s|$)/g, " ")
      .replace(/(^|\s)\(\d{4}\)(?=\s|$)/g, " ")
      .replace(/(^|\s)(ש\.?ת\.?פ|שותפות)(?=\s|$)/g, " "),
  )
    .replace(/^[\s.,-]+|[\s.,-]+$/g, "")
    .replace(/[A-Za-z]+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .trim();
}

/** Groups the register's rows (one per trade) into garages, one per mispar_mosah. */
export function groupRows(rows) {
  const byId = new Map();
  for (const r of rows) {
    const id = Number(r.mispar_mosah);
    const g = byId.get(id) ?? {
      id,
      name: plainDashes(r.shem_mosah ?? "").trim(),
      type: Number(r.cod_sug_mosah),
      address: plainDashes(r.ktovet ?? "").trim(),
      town: plainDashes(r.yishuv ?? "").trim(),
      phones: [],
      codes: new Set(),
    };
    g.phones.push(normalizePhone(r.telephone));
    g.codes.add(Number(r.cod_miktzoa));
    // A testing station is a testing station even when one of its rows says otherwise.
    if (Number(r.cod_sug_mosah) === TESTING_TYPE) g.type = TESTING_TYPE;
    byId.set(id, g);
  }
  return byId;
}

/** The coverage report's type for a garage. */
export const typeKey = (g) => TYPES[g.type]?.key ?? "unknown";

const newCoverage = () => ({
  inNorth: 0,
  osm: 0,
  exact: 0,
  near: 0,
  street: 0,
  area: 0,
  merged: 0,
  deduped: 0,
  skipped: 0,
  why: {},
});

/**
 * The register's garages in the north, each pinned or skipped with why. `geocoder` is
 * geocode.mjs's createGeocoder(); without one only OSM twins pin (the phase 1 behaviour).
 * Returns { businesses, dropped, skipped, counts, coverage, records }.
 */
export function buildGarages({ rows, osm, existing = [], geocoder = null, matcher: given }) {
  const matcher = given ?? createPlaceMatcher();
  const namer = createNamer(undefined, { extraWords: GARAGE_WORDS });
  const byId = groupRows(rows);
  const counts = {
    fetchedRows: rows.length,
    fetched: byId.size,
    outsideNorth: 0,
    townUnknown: 0,
    inNorth: 0,
    noConfidentPoint: 0,
    matchedByName: 0,
    matchedByPhone: 0,
    exact: 0,
    near: 0,
    street: 0,
    area: 0,
  };
  /** Per register type: how many in the north, how each was pinned, and why the rest were not. */
  const coverage = {};
  const cov = (g) => (coverage[typeKey(g)] ??= newCoverage());
  const isPlaceName = (words) => Boolean(matcher.match({ town: words })) || namer.isPlace(words);
  const records = [];
  const skipped = [];
  for (const g of byId.values()) {
    const m = matcher.match({ town: g.town });
    if (!m) {
      counts.townUnknown++;
      skipped.push({ id: g.id, name: g.name, town: g.town, why: "town not a Darb place" });
      continue;
    }
    if (!matcher.inNorth(m.place.slug)) {
      counts.outsideNorth++;
      continue;
    }
    counts.inNorth++;
    cov(g).inNorth++;
    g.place = m.place;
    records.push(g);
  }

  // OSM twins first: the garage itself on the map. One OSM garage claimed by several different
  // businesses pins none of them, unless exactly one has its whole name.
  const claims = new Map();
  for (const g of records) {
    g.twin = findOsmTwin(g, g.place, osm, isPlaceName);
    if (g.twin) claims.set(g.twin.el.id, [...(claims.get(g.twin.el.id) ?? []), g]);
  }
  const nameKey = (x) => [...new Set(nameWords(x.name))].sort().join(" ");
  for (const g of records) {
    if (!g.twin) continue;
    const claimants = claims.get(g.twin.el.id);
    if (claimants.length < 2) continue;
    const exact = claimants.filter((x) => x.twin?.exact);
    const sameName = claimants.every((x) => nameKey(x) === nameKey(g));
    if (!sameName && !(exact.length === 1 && exact[0] === g)) g.shared = true;
  }
  for (const g of records) if (g.shared) g.twin = null;

  const pinned = [];
  for (const g of records) {
    let pin = null;
    if (g.twin) pin = { ...g.twin.point, precision: "osm", how: g.twin.how };
    else if (geocoder) {
      const hit = geocoder.resolve({ town: g.place.slug, address: g.address });
      if (hit.skip) g.why = hit.skip;
      else pin = hit;
    } else g.why = "no OSM twin by name or phone";
    if (!pin) {
      counts.noConfidentPoint++;
      const c = cov(g);
      c.skipped++;
      c.why[g.why] = (c.why[g.why] ?? 0) + 1;
      skipped.push({ id: g.id, name: g.name, town: g.place.slug, address: g.address, why: g.why });
      continue;
    }
    g.pin = pin;
    pinned.push(g);
  }

  // One business holding several licences (same place, same name, same pin) is one card.
  const groups = new Map();
  for (const g of pinned) {
    const k = `${g.place.slug}|${nameKey(g) || g.name}|${g.pin.lat.toFixed(4)},${g.pin.lng.toFixed(4)}`;
    groups.set(k, [...(groups.get(k) ?? []), g]);
  }
  const businesses = [];
  for (const list of groups.values()) {
    // The testing station, else the one with the most trades, leads.
    list.sort(
      (a, b) =>
        Number(b.type === TESTING_TYPE) - Number(a.type === TESTING_TYPE) ||
        b.codes.size - a.codes.size,
    );
    const [g, ...others] = list;
    for (const o of others) {
      cov(o).merged++;
      counts.mergedLicences = (counts.mergedLicences ?? 0) + 1;
      o.mergedInto = g.id;
      for (const c of o.codes) g.codes.add(c);
      g.phones.push(...o.phones);
    }
    const c = cov(g);
    if (g.pin.precision === "osm") {
      c.osm++;
      counts[g.pin.how === "phone" ? "matchedByPhone" : "matchedByName"]++;
    } else {
      c[g.pin.precision]++;
      counts[g.pin.precision]++;
    }
    businesses.push(card(g, list, namer));
  }

  // A fuel or EV listing is another kind, but one OSM or a source already lists under the same
  // name at the same spot is this business: compare as if it were a garage too.
  const asGarage = existing.map((e) => ({ ...e, kinds: [...(e.kinds ?? []), "garages"] }));
  const { kept, dropped } = dedupe(businesses, { existing: asGarage, idKeys: ["motGarageId"] });
  for (const d of dropped) {
    const c = coverage[d.record.attributes.motGarageType];
    if (c) c.deduped++;
  }
  counts.deduped = dropped.length;
  assignSlugs(kept, existing);
  counts.emitted = kept.length;
  return { businesses: kept, dropped, skipped, counts, coverage, records };
}

/** One card for a garage and the licences merged into it. */
function card(g, list, namer) {
  const place = g.place;
  const key = typeKey(g);
  const testing = g.type === TESTING_TYPE || g.codes.has(181);
  const typeItem = TYPES[g.type]?.item;
  const codes = [
    ...(testing ? [181] : []),
    ...(typeItem ? [typeItem] : []),
    ...[...g.codes].sort((a, b) => a - b),
  ];
  const seen = new Set();
  const items = codes
    .map((c) => SPECIALTIES[c])
    .filter((s) => s && !seen.has(s.en) && seen.add(s.en));
  if (items.length === 0) items.push({ ...GARAGE });
  const has = (set) => [...g.codes].some((c) => set.has(c));
  const kinds = testing
    ? ["vehicle-testing", "garages"]
    : ["garages", ...(has(TYRES) ? ["tyres"] : []), ...(has(BODY) ? ["body-shops"] : [])];
  const label = testing
    ? TESTING
    : key === "licensing"
      ? LICENSING
      : key === "agricultural"
        ? AGRI
        : GARAGE;
  const own = cleanName(g.name) || g.name;
  const name = namer.name(own, place);
  const ids = list.map((x) => x.id);
  const addressHe = g.address || place.name.he;
  return business({
    slug: slugBase(testing ? "testing" : "garage", name.en),
    place: place.slug,
    kinds,
    name,
    tagline: {
      he: `${label.he} ב${place.name.he}`,
      ar: `${label.ar} في ${place.name.ar}`,
      en: `${label.en} in ${place.name.en}`,
    },
    address: {
      he: addressHe.includes(place.name.he) ? addressHe : `${addressHe}, ${place.name.he}`,
      ar: place.name.ar,
      en: place.name.en,
    },
    lat: g.pin.lat,
    lng: g.pin.lng,
    attributes: {
      motGarageId: g.id,
      ...(ids.length > 1 ? { motGarageIds: ids.join(",") } : {}),
      motGarageType: key,
      geoPrecision: g.pin.precision,
      sourceAddress: g.address,
    },
    phone: g.phones.find(Boolean) ?? null,
    screen: {
      title: label,
      items: items.slice(0, 8).map((s) => ({ label: s })),
      cta: testing ? CTA_TESTING : CTA_GARAGE,
    },
    accent: testing ? TESTING_ACCENT : ACCENT,
  });
}

/** Where the coverage report goes (gitignored .superpowers/ at the repo root). */
const COVERAGE_FILE = new URL("../../../../.superpowers/garages-coverage.json", import.meta.url);

async function main() {
  const [rows, osm, osmAddresses] = await Promise.all([
    datastore(RESOURCE),
    overpass(
      "garages",
      'nwr["shop"="car_repair"];nwr["shop"="tyres"];nwr["amenity"="vehicle_inspection"];',
    ),
    loadOsmAddresses(),
  ]);
  const matcher = createPlaceMatcher();
  const geocoder = createGeocoder(osmAddresses, matcher);
  const existing = readListings({ except: FILE });
  const { businesses, counts, coverage, skipped, records } = buildGarages({
    rows,
    osm,
    existing,
    geocoder,
    matcher,
  });
  writeListing(
    FILE,
    {
      name: "משרד התחבורה, מוסכים ומכוני רישוי (data.gov.il)",
      url: "https://data.gov.il/dataset/musachim",
      resource: RESOURCE,
      licence: "Creative Commons Attribution (CC BY), Ministry of Transport",
      region: "northern-district, haifa-district",
      fetched: today(),
      points: `${OSM_ATTRIBUTION}: the register has no coordinates. A pin is the garage itself on OSM (same town, same name or phone), else its register address on OSM's own address data (attributes.geoPrecision: exact house number, near = the nearest or interpolated number within 200 m, street = the midpoint of a named street shorter than 700 m, area = a small named industrial zone or junction in the town). Never a town centre`,
      hours: "none: the register gives no hours",
      counts,
    },
    businesses,
  );
  mkdirSync(new URL(".", COVERAGE_FILE), { recursive: true });
  writeFileSync(
    COVERAGE_FILE,
    JSON.stringify(
      {
        counts,
        coverage,
        skipped,
        testing: records
          .filter((g) => g.type === TESTING_TYPE)
          .map((g) => ({
            id: g.id,
            name: g.name,
            town: g.place.slug,
            address: g.address,
            pinned: g.pin ? { precision: g.pin.precision, lat: g.pin.lat, lng: g.pin.lng } : null,
            mergedInto: g.mergedInto ?? null,
            why: g.why ?? null,
          })),
      },
      null,
      1,
    ),
  );
  console.log(JSON.stringify(counts));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await main();
