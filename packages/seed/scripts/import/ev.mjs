// EV charging sites in the north from the Ministry of Transport's list ("עמדות טעינה לרכב
// חשמלי"). The list's coordinates (SHP and KMZ) cannot be downloaded (403), and its CSV has none,
// so a site is listed only when OpenStreetMap has a charging station in the north under the same
// name. Chargers at a fuel station are on that station's card (fuel.mjs), not here.
// Run: node packages/seed/scripts/import/ev.mjs [--refresh]
import { pathToFileURL } from "node:url";
import { dedupe } from "./dedupe.mjs";
import {
  ALWAYS_OPEN,
  assignSlugs,
  business,
  NO_HOURS,
  ensureBrands,
  readListings,
  slugBase,
  writeListing,
} from "./emit.mjs";
import { chainInName, chargerMeta } from "./ev-match.mjs";
import { datastore, overpass, pointOf, today } from "./fetch.mjs";
import { EV_RESOURCE } from "./fuel.mjs";
import { createNamer, plainDashes, tradeName } from "./names.mjs";
import { OSM_ATTRIBUTION } from "./osm.mjs";
import { createPlaceMatcher, loose, normalize } from "./places.mjs";

export const FILE = "ev-north.json";
const ACCENT = "#5fb3a8";

/** Operators by the ministry's code, as brands. */
export const OPERATORS = {
  AfconEv: { slug: "afcon-ev", name: { he: "אפקון EV", ar: "أفكون EV", en: "Afcon EV" } },
  SonolEvi: { slug: "sonol-evi", name: { he: "סונול EVI", ar: "سونول EVI", en: "Sonol EVI" } },
  Greenspot: { slug: "greenspot", name: { he: "גרינספוט", ar: "جرينسبوت", en: "Greenspot" } },
  ScalaEv: { slug: "scala-ev", name: { he: "סקאלה EV", ar: "سكالا EV", en: "Scala EV" } },
  Nofar: { slug: "nofar-ev", name: { he: "נופר", ar: "نوفار", en: "Nofar" } },
  Enova: { slug: "enova", name: { he: "אנובה", ar: "إنوفا", en: "Enova" } },
  EvEdge: { slug: "ev-edge", name: { he: "EV Edge", ar: "EV Edge", en: "EV Edge" } },
  EdgeControl: {
    slug: "edge-control",
    name: { he: "Edge Control", ar: "Edge Control", en: "Edge Control" },
  },
  Greems: { slug: "greems", name: { he: "גרימס", ar: "جريمس", en: "Greems" } },
  Lishatech: { slug: "lishatech", name: { he: "לישעטק", ar: "ليشاتك", en: "Lishatech" } },
  LishatechCPW: { slug: "lishatech", name: { he: "לישעטק", ar: "ليشاتك", en: "Lishatech" } },
  ZenEvCEP: { slug: "zen-ev", name: { he: "Zen EV", ar: "Zen EV", en: "Zen EV" } },
  ZenEv: { slug: "zen-ev", name: { he: "Zen EV", ar: "Zen EV", en: "Zen EV" } },
  InterEv: { slug: "inter-ev", name: { he: "Inter EV", ar: "Inter EV", en: "Inter EV" } },
  Gnrgy: { slug: "gnrgy", name: { he: "ג'נרג'י", ar: "جنرجي", en: "Gnrgy" } },
  SevenEv: { slug: "seven-ev", name: { he: "Seven EV", ar: "Seven EV", en: "Seven EV" } },
  ViMore: { slug: "vimore", name: { he: "ViMore", ar: "ViMore", en: "ViMore" } },
  Ev4u: { slug: "ev4u", name: { he: "EV4U", ar: "EV4U", en: "EV4U" } },
  AdviceCPW: { slug: "advice-ev", name: { he: "אדוויס", ar: "أدفايس", en: "Advice" } },
  Elexify: { slug: "elexify", name: { he: "Elexify", ar: "Elexify", en: "Elexify" } },
  Xeed: { slug: "xeed", name: { he: "Xeed", ar: "Xeed", en: "Xeed" } },
  Tesla: { slug: "tesla", name: { he: "טסלה", ar: "تسلا", en: "Tesla" } },
};
/** OSM operator and brand spellings, loose, to the ministry's codes. */
const OSM_OPERATORS = [
  [/afcon|אפקון/i, "AfconEv"],
  [/ev ?edge/i, "EvEdge"],
  [/greenspot|גרינספוט/i, "Greenspot"],
  [/tesla/i, "Tesla"],
  [/sonol|סונול/i, "SonolEvi"],
  [/enova|אנובה/i, "Enova"],
  [/nofar|נופר/i, "Nofar"],
  [/zen ?ev/i, "ZenEv"],
  [/gnrgy|ג'נרג'י/i, "Gnrgy"],
];
export function operatorOf(tags = {}) {
  const text = [tags.operator, tags.brand, tags.network].filter(Boolean).join(" ");
  const hit = OSM_OPERATORS.find(([re]) => re.test(text));
  return hit ? OPERATORS[hit[1]] : null;
}

const GENERIC = new Set(
  [
    "עמדת",
    "עמדות",
    "טעינה",
    "חניון",
    "חניה",
    "חנייה",
    "ציבורי",
    "ציבורית",
    "פרטי",
    "מרכז",
    "charging",
    "station",
    "parking",
    "public",
    "ev",
    "charger",
  ].map((w) => loose(normalize(w))),
);
/** A name's distinctive words, loose, in any script. */
export const evWords = (name) =>
  normalize(tradeName(name ?? ""))
    .split(" ")
    .map((w) => loose(w))
    .filter((w) => w.length >= 2 && !GENERIC.has(w));

/** The one OSM charging station whose name's words are all in the charger's name, or null. */
export function findCharger(record, osm) {
  const want = new Set(evWords(record.name));
  if (want.size === 0) return null;
  const hits = osm.filter((el) => {
    const names = [el.tags?.name, el.tags?.["name:he"], el.tags?.["name:en"]].filter(Boolean);
    return names.some((n) => {
      const words = evWords(n);
      return words.join("").length >= 4 && words.every((w) => want.has(w));
    });
  });
  return hits.length === 1 ? hits[0] : null;
}

const L = {
  title: { he: "עמדות טעינה לרכב חשמלי", ar: "شحن سيارات كهربائية", en: "EV charging" },
  chargers: { he: "עמדות", ar: "شواحن", en: "Chargers" },
  operator: { he: "מפעיל", ar: "الشركة المشغّلة", en: "Operator" },
  cta: { he: "ניווט לעמדה", ar: "خذني للشاحن", en: "Navigate to the charger" },
  open: { he: "פתוח 24/7", ar: "فاتح 24/7", en: "Open 24/7" },
};

/** Pure, for fixtures. `atStations`: charger names already on a fuel station's card. */
export function buildEv({ records, osm, existing = [] }) {
  const matcher = createPlaceMatcher();
  const namer = createNamer();
  const chargers = osm.filter((el) => el.tags?.amenity === "charging_station");
  const counts = {
    fetched: records.length,
    atFuelStation: 0,
    noOsmMatch: 0,
    matched: 0,
    outsideNorth: 0,
    osmOnly: 0,
  };
  const sites = new Map();
  for (const r of records) {
    // A chain's name with a station's ("סונול כרמיאל") belongs to the fuel station's card.
    if (chainInName(r.name)) {
      counts.atFuelStation++;
      continue;
    }
    const el = findCharger(r, chargers);
    if (!el) {
      counts.noOsmMatch++;
      continue;
    }
    const point = pointOf(el);
    const m = matcher.match({ names: [r.name, r.Address], ...point });
    if (!m || !matcher.inNorth(m.place.slug)) {
      counts.outsideNorth++;
      continue;
    }
    counts.matched++;
    const site = sites.get(el.id) ?? { el, point, place: m.place, records: [] };
    site.records.push(r);
    sites.set(el.id, site);
  }
  // Charging stations OSM knows with a known operator, which the ministry's list could not
  // place: listed from OSM alone.
  for (const el of chargers) {
    if (sites.has(el.id)) continue;
    const op = operatorOf(el.tags);
    if (!op) continue;
    const point = pointOf(el);
    const m = matcher.match({
      names: [el.tags["name:he"], el.tags.name].filter(Boolean),
      ...point,
    });
    if (!m || !matcher.inNorth(m.place.slug)) continue;
    counts.osmOnly++;
    sites.set(el.id, { el, point, place: m.place, records: [], op });
  }
  const businesses = [...sites.values()].map((site) => {
    const first = site.records[0];
    const t = site.el.tags ?? {};
    const op = site.op ?? OPERATORS[first?.op] ?? operatorOf(t);
    const fast = site.records.reduce((n, r) => n + (Number(r.cnt_fast) || 0), 0);
    const slow = site.records.reduce((n, r) => n + (Number(r.cnt_slow) || 0), 0);
    // A Hebrew name is named; an OSM-only site without one is called after its town.
    const ownHe =
      first?.name ??
      (/[\u05D0-\u05EA]/.test(t["name:he"] ?? t.name ?? "")
        ? (t["name:he"] ?? t.name)
        : site.place.name.he);
    const own = namer.name(plainDashes(tradeName(ownHe)).replace(/[_]/g, " "), site.place);
    const capacity = Number(t.capacity) || 0;
    const open247 = t.opening_hours?.trim() === "24/7";
    const name = op
      ? {
          he: `${op.name.he} ${own.he}`,
          ar: `${op.name.ar} ${own.ar}`,
          en: `${op.name.en} ${own.en}`,
        }
      : own;
    const meta =
      chargerMeta(fast, slow) ??
      (capacity ? { he: `${capacity}`, ar: `${capacity}`, en: `${capacity}` } : null);
    const items = [
      { label: L.chargers, ...(meta ? { meta } : {}) },
      ...(op ? [{ label: L.operator, meta: op.name }] : []),
      ...(open247 ? [{ label: L.open }] : []),
    ];
    const tagline = op
      ? {
          he: `טעינה לרכב חשמלי, ${op.name.he}`,
          ar: `شحن سيارات كهربائية، ${op.name.ar}`,
          en: `${op.name.en} EV charging`,
        }
      : L.title;
    return business({
      slug: slugBase(op?.slug ?? "ev", own.en),
      place: site.place.slug,
      brand: op?.slug ?? null,
      kinds: ["ev-charging"],
      name,
      tagline,
      address: {
        he: plainDashes(first?.Address ?? t["addr:street"] ?? "").trim() || site.place.name.he,
        ar: site.place.name.ar,
        en: site.place.name.en,
      },
      lat: site.point.lat,
      lng: site.point.lng,
      hours: open247 ? ALWAYS_OPEN : NO_HOURS,
      attributes: {
        osmId: `${site.el.type}/${site.el.id}`,
        motChargerIds: site.records.map((r) => r._id).join(","),
      },
      screen: { title: L.title, items, cta: L.cta },
      accent: ACCENT,
    });
  });
  // Two OSM points for one site (a Tesla wall of two chargers) are one card.
  const { kept, dropped } = dedupe(businesses, { existing, idKeys: ["osmId"], idsDecide: false });
  assignSlugs(kept, existing);
  counts.deduped = dropped.length;
  counts.emitted = kept.length;
  return { businesses: kept, counts };
}

async function main() {
  const [records, osm] = await Promise.all([
    datastore(EV_RESOURCE),
    overpass(
      "fuel-services",
      'nwr["shop"="convenience"];nwr["amenity"="car_wash"];nwr["amenity"="compressed_air"];nwr["amenity"="toilets"];nwr["amenity"="charging_station"];',
    ),
  ]);
  const existing = readListings({ except: FILE });
  const { businesses, counts } = buildEv({ records, osm, existing });
  ensureBrands(
    [...new Map(Object.values(OPERATORS).map((o) => [o.slug, o])).values()].filter((o) =>
      businesses.some((b) => b.brand === o.slug),
    ),
  );
  writeListing(
    FILE,
    {
      name: "משרד התחבורה, עמדות טעינה לרכב חשמלי (data.gov.il)",
      url: "https://data.gov.il/dataset/agg_charge_stations",
      resource: EV_RESOURCE,
      licence: "Creative Commons Attribution (CC BY), Ministry of Transport",
      region: "northern-district, haifa-district",
      fetched: today(),
      points: `${OSM_ATTRIBUTION}: the list's SHP and KMZ files are refused (403) and its CSV has no coordinates, so a site is listed only where an OSM charging station in the north has the same name`,
      at_fuel_stations:
        "chargers named for a chain's station are on that fuel station's card (fuel-north.json)",
      counts,
    },
    businesses,
  );
  console.log(JSON.stringify(counts));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await main();
