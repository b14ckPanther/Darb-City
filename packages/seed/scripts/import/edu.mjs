// Kindergartens and daycare centres in the north from the Education Ministry's list of
// institutions ("מוסדות חינוך"), which gives each one's official symbol, town and a point on the
// Israeli grid. Only points the ministry places by street address are used (precision high or
// very high); a point at a town's centre is not a kindergarten's door. Family daycares
// (משפחתון) are homes, so they are left out.
// Run: node packages/seed/scripts/import/edu.mjs [--refresh]
import { pathToFileURL } from "node:url";
import { dedupe } from "./dedupe.mjs";
import { assignSlugs, business, readListings, slugBase, writeListing } from "./emit.mjs";
import { datastore, today } from "./fetch.mjs";
import { itmToWgs84 } from "./itm.mjs";
import { KIND_INFO } from "./kind-map.mjs";
import { createNamer, plainDashes } from "./names.mjs";
import { BUSINESS_WORDS, SECTOR_ACCENT, taglineFor } from "./osm-allkinds.mjs";
import { createPlaceMatcher } from "./places.mjs";

export const FILE = "edu-north.json";
export const RESOURCE = "2055063b-93e8-4d6a-b2c5-c253d18c0cf6";

/** The ministry's types Darb lists, and the kind each one is. */
export const TYPES = { "גן ילדים": "kindergartens", "מעון יום": "daycare" };
const PRECISE = new Set(["גבוהה מאוד", "גבוהה"]);

const L = (he, ar, en) => ({ he, ar, en });
const LABEL = {
  symbol: L("סמל מוסד", "رمز المؤسسة", "Ministry symbol"),
  supervision: L("פיקוח", "إشراف", "Supervision"),
  special: L("חינוך מיוחד", "تربية خاصة", "Special education"),
  cta: L("ניווט לגן", "خذني للروضة", "Navigate there"),
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

/** Pure, for fixtures: ministry rows to listings. */
export function buildEdu({ rows, existing = [] }) {
  const matcher = createPlaceMatcher();
  const namer = createNamer(undefined, {
    extraWords: {
      ...BUSINESS_WORDS,
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
    const he = named ? plain : `${kind === "kindergartens" ? "גן" : "מעון"} ${plain}`;
    const name = namer.name(he, place);
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
  const { kept, dropped } = dedupe(businesses, { existing, idKeys: ["eduSymbol"] });
  counts.deduped = dropped.length;
  assignSlugs(kept, existing);
  counts.emitted = kept.length;
  return { businesses: kept, counts, dropped };
}

async function main() {
  const rows = await datastore(RESOURCE);
  const existing = readListings({ except: FILE });
  const { businesses, counts } = buildEdu({ rows, existing });
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
        "schools and other institutions (no Darb kind yet), family daycares (homes), points placed only at a town or neighbourhood centre",
      hours: "none: the list gives no hours",
      counts,
    },
    businesses,
  );
  console.log(JSON.stringify(counts));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await main();
