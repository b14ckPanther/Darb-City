// Every named food place in the north from OpenStreetMap: restaurants, cafes, shawarma and
// grills, hummus and falafel, bakeries, sweets, ice cream, juice, roasteries, butchers and
// caterers. Only places OSM gives a name; points are OSM's own (a node, or a way's centre).
// Never listed: bars, pubs, nightclubs, alcohol shops, pork, gambling and wineries (food-kinds.mjs).
// Run: node packages/seed/scripts/import/food.mjs [--refresh]
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { facebookUrl, instagramUrl, tiktokUrl, toSlug, websiteUrl } from "@darb/core";
import { hebrewFromArabic, latinFromArabic } from "./arabic-names.mjs";
import { createBoundaries, fetchBoundaries, placeAt } from "./boundaries.mjs";
import { dedupe } from "./dedupe.mjs";
import {
  assignSlugs,
  business,
  ensureBrands,
  NO_HOURS,
  readListings,
  writeListing,
} from "./emit.mjs";
import { overpass, pointOf, today } from "./fetch.mjs";
import { classify, dishLabel, exclusion, isFoodPlace, textsOf } from "./food-kinds.mjs";
import { createNamer, plainDashes } from "./names.mjs";
import { parseOpeningHours } from "./opening-hours.mjs";
import { OSM_ATTRIBUTION } from "./osm.mjs";
import { createPlaceMatcher } from "./places.mjs";
import { normalizePhone } from "./phones.mjs";

export const FILE = "food-north.json";
/** Two OSM points under one name this close are one place. */
export const SAME_FOOD_M = 80;

/** What OSM is asked for: food places, and what is never listed so the report can count it. */
export const QUERY = [
  'nwr(area.il)["amenity"~"^(restaurant|cafe|fast_food|ice_cream|food_court|juice_bar|bar|pub|nightclub|biergarten|gambling|casino)$"]',
  'nwr(area.il)["shop"~"^(bakery|pastry|confectionery|chocolate|coffee|deli|butcher|juice|nuts|alcohol|wine|beverages|lottery)$"]',
  'nwr(area.il)["craft"~"^(caterer|confectionery|winery)$"]',
  'nwr(area.il)["office"="catering"]',
]
  .map((q) => `${q};`)
  .join("");
/** Israel as OSM draws it: the bbox alone reaches into Lebanon, Syria, Jordan and Jenin. */
export const AREA = 'area["ISO3166-1"="IL"]["admin_level"="2"]->.il;';

/** Each food kind's words for taglines and screen titles, and its card accent (CARD_ACCENTS). */
export const KIND = {
  restaurants: { he: "מסעדה", ar: "مطعم", en: "Restaurant", accent: "#e08a6d" },
  cafes: { he: "בית קפה", ar: "كافيه", en: "Café", accent: "#d6a473" },
  grill: { he: "שווארמה וגריל", ar: "شاورما ومشاوي", en: "Shawarma and grill", accent: "#d9a54c" },
  hummus: { he: "חומוס ופלאפל", ar: "حمص وفلافل", en: "Hummus and falafel", accent: "#9fb86a" },
  bakeries: { he: "מאפייה", ar: "مخبز وفرن", en: "Bakery", accent: "#d9a54c" },
  sweets: { he: "ממתקים ועוגות", ar: "حلويات", en: "Sweets and cakes", accent: "#d9aaa2" },
  "ice-cream": { he: "גלידריה", ar: "بوظة", en: "Ice cream", accent: "#6fa8dc" },
  "juice-shops": {
    he: "מיצים ושייקים",
    ar: "عصير وكوكتيل",
    en: "Juice and smoothies",
    accent: "#9fb86a",
  },
  catering: { he: "קייטרינג", ar: "كيترينغ", en: "Catering", accent: "#a99bd6" },
  "food-trucks": { he: "פודטראק", ar: "فود ترك", en: "Food truck", accent: "#e08a6d" },
  roastery: {
    he: "קלייה ופיצוחים",
    ar: "محمص وبزورات",
    en: "Roastery and nuts",
    accent: "#d6a473",
  },
  "meal-prep": {
    he: "אוכל ביתי מוכן",
    ar: "أكل بيتي جاهز",
    en: "Ready home meals",
    accent: "#5fb3a8",
  },
  butchers: { he: "אטליז", ar: "ملحمة", en: "Butcher", accent: "#e08a6d" },
};
/** Each kind's own dishes: a tagline does not say them twice ("שווארמה וגריל, שווארמה"). */
const OWN = {
  grill: ["shawarma", "grill", "kebab"],
  hummus: ["hummus", "falafel"],
  bakeries: ["bread"],
  sweets: ["sweets"],
  cafes: ["coffee"],
  "ice-cream": ["ice-cream"],
  "juice-shops": ["juice"],
  catering: ["catering"],
  butchers: ["butcher"],
  "food-trucks": ["food-truck"],
  roastery: ["roastery"],
  "meal-prep": ["home-food"],
};
/** The card's first item when OSM says nothing of the menu. */
const DEFAULT_ITEM = {
  restaurants: { he: "ארוחות", ar: "وجبات", en: "Meals" },
  cafes: { he: "קפה", ar: "قهوة", en: "Coffee" },
  grill: { he: "שווארמה וגריל", ar: "شاورما ومشاوي", en: "Shawarma and grill" },
  hummus: { he: "חומוס ופלאפל", ar: "حمص وفلافل", en: "Hummus and falafel" },
  bakeries: { he: "לחם ומאפים", ar: "خبز ومعجنات", en: "Bread and pastries" },
  sweets: { he: "ממתקים ועוגות", ar: "حلويات", en: "Sweets and cakes" },
  "ice-cream": { he: "גלידה", ar: "بوظة", en: "Ice cream" },
  "juice-shops": { he: "מיצים ושייקים", ar: "عصير وكوكتيل", en: "Juice and smoothies" },
  catering: { he: "קייטרינג לאירועים", ar: "كيترينغ للمناسبات", en: "Event catering" },
  "food-trucks": { he: "אוכל רחוב", ar: "أكل شارع", en: "Street food" },
  roastery: { he: "קלייה ופיצוחים", ar: "محمص وبزورات", en: "Roasted nuts and seeds" },
  "meal-prep": { he: "אוכל ביתי", ar: "أكل بيتي", en: "Home cooking" },
  butchers: { he: "בשר טרי", ar: "لحمة طازة", en: "Fresh meat" },
};
const TAG = {
  delivery: { he: "משלוחים", ar: "توصيل", en: "Delivery" },
  takeaway: { he: "טייק אוויי", ar: "تيك أواي", en: "Takeaway" },
  outdoor: { he: "ישיבה בחוץ", ar: "قعدة برّا", en: "Outdoor seating" },
  wheelchair: { he: "נגיש לכיסא גלגלים", ar: "مناسب للكرسي المتحرك", en: "Wheelchair accessible" },
  vegan: { he: "טבעוני", ar: "نباتي صرف", en: "Vegan" },
  veganOptions: { he: "מנות טבעוניות", ar: "أكلات نباتية صرف", en: "Vegan options" },
  vegetarian: { he: "צמחוני", ar: "نباتي", en: "Vegetarian" },
  vegetarianOptions: { he: "מנות צמחוניות", ar: "أكلات نباتية", en: "Vegetarian options" },
  glutenFree: { he: "ללא גלוטן", ar: "بدون غلوتين", en: "Gluten-free" },
};
export const CTA = { he: "ניווט", ar: "خذني لهناك", en: "Directions" };

/** Food words in Hebrew names, said rather than spelt ("קפה" is Café, not "Kfa"). */
export const FOOD_WORDS = {
  מסעדה: { ar: "مطعم", en: "Restaurant" },
  מסעדת: { ar: "مطعم", en: "Restaurant" },
  קפה: { ar: "كافيه", en: "Café" },
  "בית קפה": { ar: "مقهى", en: "Café" },
  פיצה: { ar: "بيتزا", en: "Pizza" },
  פיצריה: { ar: "بيتزيريا", en: "Pizzeria" },
  פיצרייה: { ar: "بيتزيريا", en: "Pizzeria" },
  חומוס: { ar: "حمص", en: "Hummus" },
  פלאפל: { ar: "فلافل", en: "Falafel" },
  שווארמה: { ar: "شاورما", en: "Shawarma" },
  שוארמה: { ar: "شاورما", en: "Shawarma" },
  גריל: { ar: "جريل", en: "Grill" },
  מאפייה: { ar: "مخبز", en: "Bakery" },
  מאפיית: { ar: "مخبز", en: "Bakery" },
  גלידה: { ar: "بوظة", en: "Ice Cream" },
  גלידת: { ar: "بوظة", en: "Ice Cream" },
  גלידריה: { ar: "جيلاتيريا", en: "Gelateria" },
  קונדיטוריה: { ar: "حلويات", en: "Patisserie" },
  ממתקי: { ar: "حلويات", en: "Sweets" },
  המבורגר: { ar: "همبرغر", en: "Burger" },
  בורגר: { ar: "برغر", en: "Burger" },
  סושי: { ar: "سوشي", en: "Sushi" },
  אטליז: { ar: "ملحمة", en: "Butcher" },
  קייטרינג: { ar: "كيترينغ", en: "Catering" },
  מטבח: { ar: "مطبخ", en: "Kitchen" },
  ביסטרו: { ar: "بيسترو", en: "Bistro" },
  בשרים: { ar: "لحوم", en: "Meats" },
  דגים: { ar: "سمك", en: "Fish" },
  סטייקיה: { ar: "ستيك هاوس", en: "Steakhouse" },
  מיצים: { ar: "عصير", en: "Juice" },
  פודטראק: { ar: "فود ترك", en: "Food Truck" },
  עוף: { ar: "دجاج", en: "Chicken" },
  שניצל: { ar: "شنيتسل", en: "Schnitzel" },
  כנאפה: { ar: "كنافة", en: "Knafeh" },
  אספרסו: { ar: "إسبريسو", en: "Espresso" },
  יוגורט: { ar: "لبن زبادي", en: "Yogurt" },
  סלטים: { ar: "سلطات", en: "Salads" },
  שייקים: { ar: "شيك", en: "Shakes" },
  קינוחים: { ar: "تحلاية", en: "Desserts" },
  "סנדוויץ'": { ar: "سندويش", en: "Sandwich" },
  "צ'וקו": { ar: "شوكو", en: "Choco" },
  שוקו: { ar: "شوكو", en: "Choco" },
};

const HE = /[א-ת]/;
const AR = /[؀-ۿ]/;
const LATIN = /[A-Za-z]/;
const clean = (s) => plainDashes(String(s ?? "").replace(/[_]/g, " ")).trim();
/** Arabic-Indic digits as 0-9, for English names and slugs. */
const westernDigits = (s) =>
  s.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) & 0xf));
/** A slug from a name, or null when it has no Latin letters or digits. */
const slugOf = (s) => {
  try {
    return toSlug(westernDigits(s ?? ""));
  } catch {
    return null;
  }
};

/** A place's names in three languages: OSM's own first, then letters from another language. */
export function namesOf(t, namer, place) {
  const raw = clean(t.name);
  const own = {
    he: clean(t["name:he"]) || (HE.test(raw) ? raw : ""),
    ar: clean(t["name:ar"]) || (AR.test(raw) && !HE.test(raw) ? raw : ""),
    en: clean(t["name:en"]) || (LATIN.test(raw) && !HE.test(raw) && !AR.test(raw) ? raw : ""),
  };
  // A chain's own names when the place is called just by the chain ("ארומה" is Aroma).
  if (t.brand && [raw, own.he, own.en].includes(clean(t.brand))) {
    own.he ||= clean(t["brand:he"]);
    own.ar ||= clean(t["brand:ar"]);
    own.en ||= clean(t["brand:en"]);
  }
  if (own.he && !HE.test(own.he)) own.he = "";
  if (own.ar && !AR.test(own.ar)) own.ar = "";
  const fromHe = own.he ? namer.name(own.he, place) : null;
  const he = own.he || (own.ar ? hebrewFromArabic(own.ar) : own.en || raw);
  const ar = own.ar || (fromHe ? fromHe.ar : own.en || raw);
  const en = westernDigits(own.en || (fromHe ? fromHe.en : own.ar ? latinFromArabic(own.ar) : raw));
  return { he, ar, en };
}

const yes = (v) => v === "yes" || v === "only" || v === "designated";
const both = (a, b) => ({ he: `${a.he}, ${b.he}`, ar: `${a.ar}، ${b.ar}`, en: `${a.en}, ${b.en}` });
const and = (list) => ({
  he: list.map((l, i) => (i ? `ו${l.he}` : l.he)).join(" "),
  ar: list.map((l, i) => (i ? `و${l.ar}` : l.ar)).join(" "),
  en: list.map((l) => l.en).join(" and "),
});

/** Short and factual: the kind, and up to two things OSM says it serves. */
export function taglineOf(primary, dishes, styles) {
  const kind = KIND[primary];
  const own = new Set(OWN[primary] ?? []);
  // In English a dish follows in lower case ("Restaurant, burgers"); an origin keeps its capital.
  const said = [
    ...styles,
    ...dishes
      .filter((d) => !own.has(d))
      .map(dishLabel)
      .filter(Boolean)
      .map((l) => ({ ...l, en: l.en.toLowerCase() })),
  ];
  const seen = new Set();
  const labels = said.filter((l) => !seen.has(l.en) && seen.add(l.en)).slice(0, 2);
  return labels.length ? both(kind, and(labels)) : { he: kind.he, ar: kind.ar, en: kind.en };
}

/** The card: what it serves (dishes and styles), then what OSM says of the service. */
export function screenOf(primary, cls, t) {
  const seen = new Set();
  const items = [...cls.dishes.map(dishLabel), ...cls.styles]
    .filter((l) => l && !seen.has(l.en) && seen.add(l.en))
    .slice(0, 6)
    .map((label) => ({ label }));
  if (!items.length) items.push({ label: DEFAULT_ITEM[primary] });
  const tags = [];
  if (yes(t.delivery)) tags.push(TAG.delivery);
  if (yes(t.takeaway)) tags.push(TAG.takeaway);
  if (yes(t.outdoor_seating)) tags.push(TAG.outdoor);
  if (yes(t.wheelchair)) tags.push(TAG.wheelchair);
  if (t["diet:vegan"] === "only") tags.push(TAG.vegan);
  else if (t["diet:vegan"] === "yes") tags.push(TAG.veganOptions);
  if (t["diet:vegetarian"] === "only") tags.push(TAG.vegetarian);
  else if (t["diet:vegetarian"] === "yes") tags.push(TAG.vegetarianOptions);
  // Darb's gluten-free is a kitchen with no gluten at all, which OSM says only as "only".
  if (t["diet:gluten_free"] === "only") tags.push(TAG.glutenFree);
  const kind = KIND[primary];
  return { title: { he: kind.he, ar: kind.ar, en: kind.en }, tags, items, cta: CTA };
}

/** Instagram, Facebook and TikTok pages from contact:* and the plain keys. */
export function linksOf(t) {
  const links = {};
  const ig = t["contact:instagram"] ?? t.instagram;
  const fb = t["contact:facebook"] ?? t.facebook;
  const tt = t["contact:tiktok"] ?? t.tiktok;
  const site = t.website ?? t["contact:website"];
  const put = (key, fn, raw) => {
    const v = raw ? fn(String(raw).split(";")[0]) : null;
    if (v) links[key] = v;
  };
  put("instagram", instagramUrl, ig);
  put("facebook", facebookUrl, fb);
  put("tiktok", tiktokUrl, tt);
  // A "website" that is a social page goes to its link instead.
  if (site && !links.facebook && /facebook\.com/i.test(site)) put("facebook", facebookUrl, site);
  if (site && !links.instagram && /instagram\.com/i.test(site))
    put("instagram", instagramUrl, site);
  return links;
}

export function websiteOf(t) {
  const raw = String(t.website ?? t["contact:website"] ?? "")
    .split(";")[0]
    .trim();
  if (!raw || /facebook\.com|instagram\.com|tiktok\.com|wa\.me/i.test(raw)) return null;
  try {
    return websiteUrl(raw);
  } catch {
    return null;
  }
}

const HALAL = /(?<![\p{L}])(halal|حلال|חלאל)(?![\p{L}])/iu;
const hasName = (t) => Boolean(t.name || t["name:he"] || t["name:ar"] || t["name:en"]);
const closed = (t) =>
  /^(closed|off)$/i.test(t.opening_hours ?? "") ||
  /\((סגור|closed|مغلق)\)|^(סגור|closed)\b/i.test(t.name ?? "");

/** A chain's brand ({ slug, name }) when OSM names it with a Wikidata id. */
export function brandOf(t, namer) {
  if (!t.brand || !t["brand:wikidata"]) return null;
  const en =
    clean(t["brand:en"]) || (LATIN.test(t.brand) && !HE.test(t.brand) ? clean(t.brand) : "");
  const he = clean(t["brand:he"]) || (HE.test(t.brand) ? clean(t.brand) : "");
  const ar = clean(t["brand:ar"]) || (AR.test(t.brand) ? clean(t.brand) : "");
  const fromHe = he ? namer.name(he) : null;
  const name = {
    he: he || (ar ? hebrewFromArabic(ar) : en),
    ar: ar || fromHe?.ar || en,
    en: en || fromHe?.en || (ar ? latinFromArabic(ar) : ""),
  };
  const slug = slugOf(name.en);
  return slug && name.en ? { slug, name } : null;
}

/** Pure, for fixtures. `existing`: published businesses; `taken`: every { place, slug } in use. */
export function buildFood({ osm, boundaries = [], existing = [], taken = [], brands = [] }) {
  const matcher = createPlaceMatcher();
  const areas = createBoundaries(boundaries);
  const namer = createNamer(undefined, { extraWords: FOOD_WORDS });
  const knownBrands = new Map(brands.map((b) => [b.slug, b]));
  const counts = {
    fetched: osm.length,
    unnamed: 0,
    notFood: 0,
    closed: 0,
    halalInName: 0,
    excluded: {},
    noPlace: 0,
    conflict: 0,
    outsideNorth: 0,
  };
  const seenIds = new Set();
  const usedBrands = new Map();
  const records = [];
  for (const el of osm) {
    const id = `${el.type}/${el.id}`;
    if (seenIds.has(id)) continue;
    seenIds.add(id);
    const t = el.tags ?? {};
    const why = exclusion(t);
    if (why) {
      counts.excluded[why] = (counts.excluded[why] ?? 0) + 1;
      continue;
    }
    if (!isFoodPlace(t)) {
      counts.notFood++;
      continue;
    }
    if (!hasName(t)) {
      counts.unnamed++;
      continue;
    }
    if (closed(t)) {
      counts.closed++;
      continue;
    }
    // Darb never writes the word halal, so a place named with it is left for its owner to list.
    if (HALAL.test(textsOf(t).join(" | "))) {
      counts.halalInName++;
      continue;
    }
    const point = pointOf(el);
    const m = placeAt(matcher, areas, { town: t["addr:city:he"] ?? t["addr:city"], ...point });
    if (m?.how === "conflict") {
      counts.conflict++;
      continue;
    }
    if (!m?.place) {
      counts.noPlace++;
      continue;
    }
    if (!matcher.inNorth(m.place.slug)) {
      counts.outsideNorth++;
      continue;
    }
    const place = m.place;
    const cls = classify(t);
    const primary = cls.kinds[0];
    const name = namesOf(t, namer, place);
    let brand = brandOf(t, namer);
    // A brand slug Darb already uses for something else is not this chain's.
    if (
      brand &&
      knownBrands.has(brand.slug) &&
      knownBrands.get(brand.slug).name.en !== brand.name.en
    )
      brand = null;
    if (brand) usedBrands.set(brand.slug, knownBrands.get(brand.slug) ?? brand);
    const street = clean(t["addr:street"]);
    const number = clean(t["addr:housenumber"]);
    const streetHe = HE.test(street) ? [street, number].filter(Boolean).join(" ") : "";
    const streetOf = (key) => {
      const s = clean(t[`addr:street:${key}`]);
      return s ? [s, number].filter(Boolean).join(" ") : "";
    };
    const address = {
      he: streetHe ? `${streetHe}, ${place.name.he}` : place.name.he,
      ar: streetOf("ar") ? `${streetOf("ar")}، ${place.name.ar}` : place.name.ar,
      en: streetOf("en") ? `${streetOf("en")}, ${place.name.en}` : place.name.en,
    };
    const parsed = parseOpeningHours(t.opening_hours);
    const attributes = { osmId: id };
    if (t.delivery === "yes" || t.delivery === "only") attributes.delivers = true;
    else if (t.delivery === "no") attributes.delivers = false;
    if (yes(t.takeaway)) attributes.takeaway = true;
    if (yes(t.outdoor_seating)) attributes.outdoorSeating = true;
    if (yes(t.wheelchair)) attributes.wheelchair = true;
    if (yes(t["diet:vegan"])) attributes.vegan = true;
    if (yes(t["diet:vegetarian"])) attributes.vegetarian = true;
    const phone =
      normalizePhone(t.phone) ??
      normalizePhone(t["contact:phone"]) ??
      normalizePhone(t["contact:mobile"]) ??
      normalizePhone(t.mobile);
    const whatsapp = normalizePhone(t["contact:whatsapp"]);
    const b = business({
      slug: slugOf(name.en) ?? primary,
      place: place.slug,
      brand: brand?.slug ?? null,
      kinds: cls.kinds,
      name,
      tagline: taglineOf(primary, cls.dishes, cls.styles),
      address,
      lat: point.lat,
      lng: point.lng,
      hours: parsed ?? NO_HOURS,
      attributes,
      phone,
      whatsapp,
      website: websiteOf(t),
      links: linksOf(t),
      dietary: t["diet:gluten_free"] === "only" ? ["gluten_free"] : [],
      screen: screenOf(primary, cls, t),
      accent: KIND[primary].accent,
    });
    records.push(b);
  }
  const { kept, dropped } = dedupe(records, {
    existing,
    idKeys: ["osmId"],
    idsDecide: false,
    metres: SAME_FOOD_M,
  });
  assignSlugs(kept, taken);
  counts.duplicates = dropped.filter((d) => d.why === "duplicate").length;
  counts.alreadyListed = dropped.filter((d) => d.why === "existing").length;
  counts.emitted = kept.length;
  const brandsUsed = [...usedBrands.values()].filter((b) => kept.some((k) => k.brand === b.slug));
  for (const k of kept) if (k.brand && !brandsUsed.some((b) => b.slug === k.brand)) k.brand = null;
  return { businesses: kept, counts, brands: brandsUsed, dropped };
}

const read = (file) =>
  JSON.parse(readFileSync(new URL(`../../data/${file}`, import.meta.url), "utf8"));

async function main() {
  const osm = await overpass("food-il", QUERY, { prelude: AREA });
  const boundaries = await fetchBoundaries();
  const listings = readListings({ except: FILE });
  const clients = read("clients.json").businesses;
  const showroom = read("businesses.json");
  const existing = [...clients, ...listings];
  const taken = [...existing, ...showroom];
  const { businesses, counts, brands } = buildFood({
    osm,
    boundaries,
    existing,
    taken,
    brands: read("brands.json"),
  });
  counts.brandsAdded = ensureBrands(brands);
  writeListing(
    FILE,
    {
      name: "OpenStreetMap, named food places in the north",
      url: "https://www.openstreetmap.org",
      licence: "Open Database License (ODbL)",
      attribution: OSM_ATTRIBUTION,
      region: "northern-district, haifa-district",
      fetched: today(),
      query: `Overpass: ${AREA} ${QUERY}`,
      points: "OSM's own: a node's point, or a way's or relation's centre",
      places:
        "the town in OSM's address, else the municipality (OSM admin_level 8) the point stands in, else the nearest settlement inside its regional council",
      never_listed:
        "bars, pubs, nightclubs, brewpubs and places named for beer or wine, alcohol and wine shops, pork, gambling and lottery, wineries",
      counts,
    },
    businesses,
  );
  console.log(JSON.stringify(counts));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await main();
