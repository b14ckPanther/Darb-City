// Licensed garages and vehicle testing stations in the north, from the Ministry of Transport's
// register ("מוסכים ומכוני רישוי"). The register has no coordinates, so a garage is listed only
// when OpenStreetMap has it in its own town under the same name or phone; every other record is
// skipped and counted. Pins are never invented.
// Run: node packages/seed/scripts/import/garages.mjs [--refresh]
import { pathToFileURL } from "node:url";
import { dedupe } from "./dedupe.mjs";
import { business, createSlugger, readListings, writeListing } from "./emit.mjs";
import { datastore, overpass, pointOf, today } from "./fetch.mjs";
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

/** The register's specialties, by code, as items on the card. Unknown codes are left out. */
export const SPECIALTIES = {
  10: { he: "מכונאות בנזין", ar: "ميكانيك بنزين", en: "Petrol engines" },
  20: { he: "מכונאות דיזל", ar: "ميكانيك ديزل", en: "Diesel engines" },
  21: { he: "משאיות ואוטובוסים", ar: "شاحنات وباصات", en: "Trucks and buses" },
  23: { he: "רכב חשמלי והיברידי", ar: "سيارات كهربائية وهايبرد", en: "Electric and hybrid cars" },
  15: { he: "אוטוטק", ar: "أوتوتك", en: "Autotech" },
  30: { he: "חשמל רכב", ar: "كهرباء سيارات", en: "Auto electrics" },
  60: { he: "רדיאטורים", ar: "رادياتيرات", en: "Radiators" },
  70: { he: "פחחות", ar: "سمكرة", en: "Bodywork" },
  80: { he: "מסגרות רכב", ar: "حدادة سيارات", en: "Chassis work" },
  81: { he: "אגזוזים", ar: "إكزوزات", en: "Exhausts" },
  100: { he: "צבע רכב", ar: "دهان سيارات", en: "Paintwork" },
  130: { he: "צמיגים", ar: "كاوتشوك", en: "Tyres" },
  135: { he: "צמיגים", ar: "كاوتشوك", en: "Tyres" },
  143: { he: "בלמים", ar: "فرامل", en: "Brakes" },
  150: { he: "אופנועים וקטנועים", ar: "موتورات وسكوترات", en: "Motorbikes and scooters" },
  155: { he: "אופנועים וטרקטורונים", ar: "موتورات وتراكترونات", en: "Motorbikes and quads" },
  170: { he: "בדיקת עשן לדיזל", ar: "فحص دخان للديزل", en: "Diesel smoke test" },
  175: { he: "פחחות וצבע", ar: "سمكرة ودهان", en: "Bodywork and paint" },
  177: { he: "פחחות וצבע", ar: "سمكرة ودهان", en: "Bodywork and paint" },
  180: { he: "בדיקה לפני קנייה", ar: "فحص قبل الشرا", en: "Pre-purchase check" },
  181: { he: "טסט שנתי", ar: "تست سنوي", en: "Annual vehicle test" },
  187: { he: "רישום רכב חדש", ar: "تسجيل سيارة جديدة", en: "New car registration" },
  188: { he: "רישוי רכב חדש", ar: "ترخيص سيارة جديدة", en: "New car licensing" },
  190: { he: "טרקטורים", ar: "تراكتورات", en: "Tractors" },
  191: { he: "טרקטורונים", ar: "تراكترونات", en: "Quads" },
  194: { he: "מלגזות", ar: "رافعات شوكية", en: "Forklifts" },
  195: { he: "מתלים וכיוון", ar: "تعليق وميزان", en: "Suspension and alignment" },
  202: { he: "חילוץ ותיקון בדרך", ar: "إنقاذ وتصليح عالطريق", en: "Roadside repairs" },
  205: { he: "מזגנים לרכב", ar: "مكيفات سيارات", en: "Car air conditioning" },
  206: { he: "תיבות הילוכים אוטומטיות", ar: "جيرات أوتوماتيك", en: "Automatic gearboxes" },
  300: { he: "בדיקה אחרי תאונה", ar: "فحص بعد حادث", en: "Post-accident check" },
  301: { he: "בדיקה אחרי תאונה", ar: "فحص بعد حادث", en: "Post-accident check" },
};
const TYRES = new Set([130, 135]);
const BODY = new Set([70, 100, 175, 177]);

const GARAGE = { he: "מוסך מורשה", ar: "كراج مرخّص", en: "Licensed garage" };
const TESTING = { he: "מכון רישוי", ar: "مكان فحص سيارات (تست)", en: "Vehicle testing station" };
const CTA_GARAGE = { he: "ניווט למוסך", ar: "خذني للكراج", en: "Navigate to the garage" };
const CTA_TESTING = { he: "ניווט למכון", ar: "خذني للتست", en: "Navigate to the testing station" };

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

/** Groups the register's rows (one per specialty) into garages. Pure, for fixtures. */
export function buildGarages({ rows, osm, existing = [] }) {
  const matcher = createPlaceMatcher();
  const namer = createNamer(undefined, {
    extraWords: {
      מוסך: { ar: "كراج", en: "Garage", after: true },
      "מכון רישוי": { ar: "تست", en: "Testing", after: true },
      צמיגי: { ar: "كاوتشوك", en: "Tyres", after: true },
    },
  });
  const byId = new Map();
  for (const r of rows) {
    const id = Number(r.mispar_mosah);
    const g = byId.get(id) ?? {
      id,
      name: plainDashes(r.shem_mosah ?? "").trim(),
      type: Number(r.cod_sug_mosah),
      typeName: r.sug_mosah,
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
  const counts = {
    fetchedRows: rows.length,
    fetched: byId.size,
    outsideNorth: 0,
    townUnknown: 0,
    inNorth: 0,
    noConfidentPoint: 0,
    matchedByName: 0,
    matchedByPhone: 0,
  };
  const slugFor = createSlugger(existing.map((b) => `${b.place}/${b.slug}`));
  const isPlaceName = (words) => Boolean(matcher.match({ town: words })) || namer.isPlace(words);
  // First pass: which register entries claim each OSM garage. Entries under one name (one
  // business holding several licences) merge into one card; different names share nothing.
  const claims = new Map();
  for (const g of byId.values()) {
    const m = matcher.match({ town: g.town });
    if (!m || !matcher.inNorth(m.place.slug)) continue;
    const twin = findOsmTwin(g, m.place, osm, isPlaceName);
    if (twin) claims.set(twin.el.id, [...(claims.get(twin.el.id) ?? []), g]);
  }
  const merged = new Set();
  const skipped = [];
  const businesses = [];
  for (const g of byId.values()) {
    if (merged.has(g.id)) continue;
    const m = matcher.match({ town: g.town });
    if (!m) {
      counts.townUnknown++;
      skipped.push({ id: g.id, why: "town not a Darb place", town: g.town });
      continue;
    }
    if (!matcher.inNorth(m.place.slug)) {
      counts.outsideNorth++;
      continue;
    }
    counts.inNorth++;
    const twin = findOsmTwin(g, m.place, osm, isPlaceName);
    if (!twin) {
      counts.noConfidentPoint++;
      continue;
    }
    const claimants = claims.get(twin.el.id) ?? [g];
    if (claimants.length > 1) {
      const key = (x) => [...new Set(nameWords(x.name))].sort().join(" ");
      // Several businesses answer this OSM garage: it is the one whose name is exactly its name.
      const exact = claimants.filter((x) => findOsmTwin(x, m.place, osm, isPlaceName)?.exact);
      const sameName = claimants.every((x) => key(x) === key(g));
      if (!sameName && !(exact.length === 1 && exact[0] === g)) {
        counts.noConfidentPoint++;
        counts.sharedOsm = (counts.sharedOsm ?? 0) + 1;
        continue;
      }
      for (const other of sameName ? claimants : []) {
        if (other === g) continue;
        merged.add(other.id);
        counts.mergedLicences = (counts.mergedLicences ?? 0) + 1;
        counts.inNorth++;
        for (const c of other.codes) g.codes.add(c);
        g.phones.push(...other.phones);
        if (other.type === TESTING_TYPE) g.type = TESTING_TYPE;
        g.ids = [...(g.ids ?? [g.id]), other.id];
      }
    }
    counts[twin.how === "phone" ? "matchedByPhone" : "matchedByName"]++;
    const testing = g.type === TESTING_TYPE || g.codes.has(181);
    const seen = new Set();
    const items = [...g.codes]
      .sort((a, b) => a - b)
      .map((c) => SPECIALTIES[c])
      .filter((s) => s && !seen.has(s.en) && seen.add(s.en));
    if (testing && !seen.has("Annual vehicle test")) items.unshift(SPECIALTIES[181]);
    if (items.length === 0) items.push({ ...GARAGE });
    const kinds = testing
      ? ["vehicle-testing", "garages"]
      : [
          "garages",
          ...([...g.codes].some((c) => TYRES.has(c)) ? ["tyres"] : []),
          ...([...g.codes].some((c) => BODY.has(c)) ? ["body-shops"] : []),
        ];
    const label = testing ? TESTING : GARAGE;
    const own = tradeName(g.name) || g.name;
    const name = namer.name(own, m.place);
    businesses.push(
      business({
        slug: slugFor(m.place.slug, testing ? "testing" : "garage", name.en),
        place: m.place.slug,
        kinds,
        name,
        tagline: {
          he: `${label.he} ב${m.place.name.he}`,
          ar: `${label.ar} في ${m.place.name.ar}`,
          en: `${label.en} in ${m.place.name.en}`,
        },
        address: { he: g.address || m.place.name.he, ar: m.place.name.ar, en: m.place.name.en },
        lat: twin.point.lat,
        lng: twin.point.lng,
        attributes: {
          motGarageId: g.id,
          ...(g.ids ? { motGarageIds: g.ids.join(",") } : {}),
        },
        phone: g.phones.find(Boolean) ?? null,
        screen: {
          title: label,
          items: items.slice(0, 8).map((s) => ({ label: s })),
          cta: testing ? CTA_TESTING : CTA_GARAGE,
        },
        accent: testing ? TESTING_ACCENT : ACCENT,
      }),
    );
  }
  const { kept, dropped } = dedupe(businesses, { existing, idKeys: ["motGarageId"] });
  counts.deduped = dropped.length;
  counts.emitted = kept.length;
  return { businesses: kept, dropped, skipped, counts };
}

async function main() {
  const [rows, osm] = await Promise.all([
    datastore(RESOURCE),
    overpass(
      "garages",
      'nwr["shop"="car_repair"];nwr["shop"="tyres"];nwr["amenity"="vehicle_inspection"];',
    ),
  ]);
  const existing = readListings({ except: FILE });
  const { businesses, counts } = buildGarages({ rows, osm, existing });
  writeListing(
    FILE,
    {
      name: "משרד התחבורה, מוסכים ומכוני רישוי (data.gov.il)",
      url: "https://data.gov.il/dataset/musachim",
      resource: RESOURCE,
      licence: "Creative Commons Attribution (CC BY), Ministry of Transport",
      region: "northern-district, haifa-district",
      fetched: today(),
      points: `${OSM_ATTRIBUTION}: the register has no coordinates, so a garage is listed only where OSM has it in its town under the same Hebrew name or phone`,
      hours: "none: the register gives no hours",
      counts,
    },
    businesses,
  );
  console.log(JSON.stringify(counts));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await main();
