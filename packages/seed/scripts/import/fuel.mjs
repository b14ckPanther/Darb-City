// Every public fuel station in the north but Paz's (data/listings/paz-north.json has those), from
// the Energy Ministry's list, with official phones, services from OpenStreetMap and EV chargers
// from the Ministry of Transport. Run: node packages/seed/scripts/import/fuel.mjs [--refresh]
import { pathToFileURL } from "node:url";
import { stationForCharger, chargerMeta } from "./ev-match.mjs";
import {
  ALWAYS_OPEN,
  NO_HOURS,
  business,
  createSlugger,
  ensureBrands,
  readListings,
  writeListing,
} from "./emit.mjs";
import { datastore, overpass, today } from "./fetch.mjs";
import { dedupe } from "./dedupe.mjs";
import { createNamer, plainDashes, tradeName } from "./names.mjs";
import { near, OSM_ATTRIBUTION, stationServices } from "./osm.mjs";
import { normalizePhone } from "./phones.mjs";
import { createPlaceMatcher, loose, normalize } from "./places.mjs";

export const FILE = "fuel-north.json";
export const STATIONS_RESOURCE = "5537a0ef-3eeb-449c-90c8-51e27564f0cb";
export const PHONES_RESOURCE = "ff3b653c-d268-4eb7-a86b-6de69e77043a";
export const EV_RESOURCE = "528482f2-d410-4d62-8b17-566ab23a1c52";

/**
 * The chains, by the ministry's company name. Accents are the closest brand-safe CARD_ACCENTS
 * (packages/core/src/card.ts) to each chain's own colour; websites only where checked.
 */
export const CHAINS = {
  סונול: {
    slug: "sonol",
    name: { he: "סונול", ar: "سونول", en: "Sonol" },
    accent: "#6fa8dc",
    website: "https://www.sonol.co.il",
  },
  דלק: {
    slug: "delek",
    name: { he: "דלק", ar: "دلك", en: "Delek" },
    accent: "#e08a6d",
    website: "https://www.delek.co.il",
  },
  "דור אלון": {
    slug: "dor-alon",
    name: { he: "דור אלון", ar: "دور ألون", en: "Dor Alon" },
    accent: "#d9aaa2",
    website: "https://www.doralon.co.il",
  },
  טן: {
    slug: "ten",
    name: { he: "טן", ar: "تن", en: "Ten" },
    accent: "#9fb86a",
    website: null,
  },
  'סד"ש': {
    slug: "sadash",
    name: { he: 'סד"ש', ar: "سادش", en: "Sadash" },
    accent: "#5fb3a8",
    website: "https://www.sadash.co.il",
  },
  יעד: {
    slug: "yaad",
    name: { he: "יעד", ar: "يعاد", en: "Yaad" },
    accent: "#a99bd6",
    website: null,
  },
  תפוז: {
    slug: "tapuz",
    name: { he: "תפוז", ar: "تبوز", en: "Tapuz" },
    accent: "#d6a473",
    website: null,
  },
};
const ALIASES = { "דור-אלון": "דור אלון" };
const INDEPENDENT_ACCENT = "#d6a473";

export const chainOf = (company) => {
  const c = plainDashes(company ?? "").trim();
  return CHAINS[ALIASES[c] ?? c] ?? null;
};

const STATION = { he: "תחנת דלק", ar: "محطة وقود", en: "fuel station" };
const ITEM = {
  fuel: { he: "דלק", ar: "وقود", en: "Fuel" },
  store: { he: "חנות נוחות", ar: "دكانة", en: "Convenience store" },
  wash: { he: "שטיפת רכב", ar: "غسيل سيارات", en: "Car wash" },
  air: { he: "אוויר לצמיגים", ar: "هوا للكاوتشوك", en: "Tyre air" },
  ev: { he: "טעינה לרכב חשמלי", ar: "شحن سيارات كهربائية", en: "EV charging" },
  self: { he: "שירות עצמי", ar: "خدمة ذاتية", en: "Self-service" },
  toilets: { he: "שירותים", ar: "حمامات", en: "Toilets" },
  access: { he: "נגיש לכיסא גלגלים", ar: "مناسب للكراسي المتحركة", en: "Wheelchair accessible" },
  open: { he: "פתוח 24/7", ar: "فاتح 24/7", en: "Open 24/7" },
};
const GRADE = {
  95: { he: "95", ar: "95", en: "95" },
  98: { he: "98", ar: "98", en: "98" },
  diesel: { he: "סולר", ar: "سولار", en: "Diesel" },
};
const CTA = { he: "ניווט לתחנה", ar: "خذني للمحطة", en: "Navigate to the station" };

const tagline = (chain, open247) => {
  const he = chain ? `${STATION.he} ${chain.name.he}` : STATION.he;
  const ar = chain ? `${STATION.ar} ${chain.name.ar}` : STATION.ar;
  const en = chain ? `${chain.name.en} ${STATION.en}` : "Fuel station";
  return open247
    ? { he: `${he}, פתוחה 24/7`, ar: `${ar}، فاتحة 24/7`, en: `${en}, open 24/7` }
    : { he, ar, en };
};

/**
 * The name on the card: the chain, then the station's own name without the chain's word. An
 * independent station named only after its town is "תחנת דלק <town>".
 */
function stationName(chain, rawName, place, namer) {
  let own = tradeName(rawName);
  if (chain) {
    const words = own.split(" ");
    const chainWords = chain.name.he.split(" ").length;
    const lead = words.slice(0, chainWords).join(" ");
    if (loose(normalize(lead)) === loose(normalize(chain.name.he)))
      own = words.slice(chainWords).join(" ");
    // "יעד יעד-סטאר": the chain's word once is enough.
    own = own.replace(new RegExp(`^${chain.name.he}\\s*-\\s*`), "").trim();
    if (!own) own = place.name.he;
    const named = namer.name(own, place);
    return {
      he: `${chain.name.he} ${named.he}`,
      ar: `${chain.name.ar} ${named.ar}`,
      en: `${chain.name.en} ${named.en}`,
    };
  }
  if (!own) own = place.name.he;
  const named = namer.name(own, place);
  const justTown = namer.isPlace(own);
  return justTown
    ? {
        he: `${STATION.he} ${named.he}`,
        ar: `${STATION.ar} ${named.ar}`,
        en: `${named.en} Fuel Station`,
      }
    : named;
}

/**
 * Builds the listings from already-fetched data. Pure, so a fixture can run it.
 * `existing`: businesses already published (Paz), skipped by fuelAdminNo.
 */
export function buildFuel({ stations, phones, osmFuel, osmServices, ev = [], existing = [] }) {
  const matcher = createPlaceMatcher();
  // In an independent station's own name, "דלק" is the word for fuel, not the chain.
  const namer = createNamer(undefined, { extraWords: { דלק: { ar: "وقود", en: "Fuel" } } });
  const phoneOf = new Map(phones.map((p) => [Number(p.station_number), p]));
  const counts = {
    fetched: stations.length,
    paz: 0,
    outsideNorth: 0,
    noPlace: 0,
    noPoint: 0,
    matchedByName: 0,
    matchedNearest: 0,
    osmMatched: 0,
    open247: 0,
    withPhone: 0,
    evAttached: 0,
  };
  const slugFor = createSlugger(existing.map((b) => `${b.place}/${b.slug}`));
  const records = [];
  for (const s of stations) {
    const company = plainDashes(s["חברה"] ?? "").trim();
    if (company === "פז") {
      counts.paz++;
      continue;
    }
    const lat = Number(s["נ.צ. רוחב"]);
    const lng = Number(s["נ.צ. אורך"]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat === 0) {
      counts.noPoint++;
      continue;
    }
    const no = Number(s["מס_מינהל_הדלק"]);
    const phoneRow = phoneOf.get(no);
    const m = matcher.match({
      town: s["רשות_מקומית"],
      names: [phoneRow?.City, s["שם_תחנה"]],
      lat,
      lng,
    });
    if (!m) {
      // Far from any settlement: only a station outside the north can be that far.
      counts[lat > 32.3 && lat < 33.4 && lng > 34.8 && lng < 35.95 ? "noPlace" : "outsideNorth"]++;
      continue;
    }
    if (!matcher.inNorth(m.place.slug)) {
      counts.outsideNorth++;
      continue;
    }
    counts[m.how === "name" ? "matchedByName" : "matchedNearest"]++;
    const chain = chainOf(company);
    const point = { lat, lng };
    const fuelEl = near(osmFuel, point)[0]?.el ?? null;
    if (fuelEl) counts.osmMatched++;
    const services = stationServices(fuelEl, fuelEl ? near(osmServices, point) : []);
    const name = stationName(chain, s["שם_תחנה"] || m.place.name.he, m.place, namer);
    const phone = normalizePhone(phoneRow?.telephone);
    if (phone) counts.withPhone++;
    if (services.open247) counts.open247++;
    records.push({
      no,
      chain,
      services,
      name,
      phone,
      place: m.place,
      point,
      match: m,
      address: plainDashes(s["כתובת"] ?? "").trim() || m.place.name.he,
      rawName: plainDashes(s["שם_תחנה"] ?? "").trim(),
      company,
      ev: null,
    });
  }

  // Chargers the Ministry of Transport lists at these stations, by name.
  const keys = records.map((r) => ({
    brand: r.chain?.slug ?? null,
    keys: [r.rawName, r.place.name.he, `${r.place.name.he} ${r.rawName}`].filter(Boolean),
    ref: r,
  }));
  for (const c of ev) {
    const r = stationForCharger(c.name, keys);
    if (!r) continue;
    const prev = r.ev ?? { fast: 0, slow: 0, ops: new Set() };
    prev.fast += Number(c.cnt_fast) || 0;
    prev.slow += Number(c.cnt_slow) || 0;
    prev.ops.add(c.op);
    r.ev = prev;
  }

  const businesses = records.map((r) => {
    const { services: sv, chain } = r;
    const evMeta = r.ev ? chargerMeta(r.ev.fast, r.ev.slow) : null;
    if (r.ev) counts.evAttached++;
    const hasEv = sv.ev || Boolean(r.ev);
    const items = [
      sv.grades.length
        ? {
            label: ITEM.fuel,
            meta: Object.fromEntries(
              ["he", "ar", "en"].map((l) => [l, sv.grades.map((g) => GRADE[g][l]).join(" · ")]),
            ),
          }
        : { label: ITEM.fuel },
      ...(sv.store ? [{ label: ITEM.store }] : []),
      ...(sv.wash ? [{ label: ITEM.wash }] : []),
      ...(sv.air ? [{ label: ITEM.air }] : []),
      ...(hasEv ? [{ label: ITEM.ev, ...(evMeta ? { meta: evMeta } : {}) }] : []),
      ...(sv.self ? [{ label: ITEM.self }] : []),
      ...(sv.toilets ? [{ label: ITEM.toilets }] : []),
      ...(sv.access ? [{ label: ITEM.access }] : []),
      ...(sv.open247 ? [{ label: ITEM.open }] : []),
    ];
    const line = tagline(chain, sv.open247);
    return business({
      slug: slugFor(r.place.slug, chain?.slug ?? "fuel", stripChain(r.name.en, chain)),
      place: r.place.slug,
      brand: chain?.slug ?? null,
      kinds: ["stations", ...(sv.wash ? ["car-wash"] : []), ...(hasEv ? ["ev-charging"] : [])],
      name: r.name,
      tagline: line,
      address: { he: r.address, ar: r.place.name.ar, en: r.place.name.en },
      lat: r.point.lat,
      lng: r.point.lng,
      hours: sv.open247 ? ALWAYS_OPEN : NO_HOURS,
      attributes: { fuelAdminNo: r.no },
      phone: r.phone,
      website: chain?.website ?? null,
      screen: { title: line, items, cta: CTA },
      accent: chain?.accent ?? INDEPENDENT_ACCENT,
    });
  });

  const { kept, dropped } = dedupe(businesses, { existing, idKeys: ["fuelAdminNo"] });
  counts.inNorth = records.length;
  counts.deduped = dropped.length;
  counts.emitted = kept.length;
  return { businesses: kept, dropped, counts };
}

const stripChain = (en, chain) =>
  chain && en.startsWith(`${chain.name.en} `) ? en.slice(chain.name.en.length + 1) : en;

async function main() {
  const [stations, phones, ev, osmFuel, osmServices] = await Promise.all([
    datastore(STATIONS_RESOURCE),
    datastore(PHONES_RESOURCE),
    datastore(EV_RESOURCE),
    overpass("fuel", 'nwr["amenity"="fuel"];'),
    overpass(
      "fuel-services",
      'nwr["shop"="convenience"];nwr["amenity"="car_wash"];nwr["amenity"="compressed_air"];nwr["amenity"="toilets"];nwr["amenity"="charging_station"];',
    ),
  ]);
  const existing = readListings({ except: FILE });
  const { businesses, dropped, counts } = buildFuel({
    stations,
    phones,
    osmFuel,
    osmServices,
    ev,
    existing,
  });
  ensureBrands(Object.values(CHAINS).filter((c) => businesses.some((b) => b.brand === c.slug)));
  writeListing(
    FILE,
    {
      name: "משרד האנרגיה, רשימת תחנות הדלק הציבוריות (data.gov.il)",
      url: "https://data.gov.il/dataset/gas-station",
      resource: STATIONS_RESOURCE,
      licence: "data.gov.il, Other (Open)",
      region: "northern-district, haifa-district",
      companies: "every company but פז (data/listings/paz-north.json)",
      fetched: today(),
      phones: `משרד האנרגיה, מאגר תחנות הדלק (data.gov.il resource ${PHONES_RESOURCE})`,
      hours: "24/7 only where OpenStreetMap says opening_hours=24/7; otherwise no hours",
      services: `${OSM_ATTRIBUTION}: fuel grades and services within 150 m`,
      ev: `Ministry of Transport, EV charging stations (data.gov.il resource ${EV_RESOURCE}, CC BY), matched by chain and station name`,
      websites:
        "the chain's own site where checked (sonol.co.il, delek.co.il, doralon.co.il, sadash.co.il)",
      counts,
    },
    businesses,
  );
  console.log(JSON.stringify(counts));
  for (const d of dropped.slice(0, 20))
    console.log(`  dropped ${d.record.place}/${d.record.slug} (${d.why}, kept ${d.keptAs})`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await main();
