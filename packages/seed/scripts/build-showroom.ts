import { writeFileSync } from "node:fs";
import { toSlug, type Hours, type Template } from "@darb/core";
import {
  loadKinds,
  loadPlaces,
  loadScreens,
  type SeedBrand,
  type SeedBusinessRecord,
} from "../src/index.js";

const FLAGSHIP_CBS = new Set([
  "4000",
  "7600",
  "1292",
  "7500",
  "6800",
  "9500",
  "8200",
  "9600",
  "1063",
  "522",
  "8900",
]);
export const COMMON_KINDS = [
  "restaurants",
  "cafes",
  "grill",
  "bakeries",
  "hummus",
  "sweets",
  "barbershops",
  "salons",
  "pharmacies",
  "dental",
  "gyms",
  "garages",
  "technicians",
  "device-repair",
  "butchers",
  "mosques",
];

const h = (open: string, close: string) => [{ open, close }];
const week = (days: number[], open: string, close: string) =>
  Object.fromEntries(days.map((d) => [d, h(open, close)]));
const HOURS: Partial<Record<Template, Hours>> = {
  menu: {
    weekly: { ...week([0, 1, 2, 3, 4], "11:00", "23:00"), ...week([5, 6], "12:00", "01:00") },
    exceptions: [],
  },
  booking: {
    weekly: { ...week([0, 1, 2, 3, 4], "09:00", "19:00"), 5: h("09:00", "14:00") },
    exceptions: [],
  },
  shop: {
    weekly: { ...week([0, 1, 2, 3, 4], "09:00", "20:00"), 5: h("09:00", "15:00") },
    exceptions: [],
  },
};
const DEFAULT_HOURS: Hours = { weekly: week([0, 1, 2, 3, 4], "08:00", "17:00"), exceptions: [] };
const MOSQUE_HOURS: Hours = {
  weekly: week([0, 1, 2, 3, 4, 5, 6], "04:00", "23:00"),
  exceptions: [],
};

/** Deterministic offset of up to ~600 m so example businesses do not stack on the place centre. */
function jitter(seed: string): [number, number] {
  let x = 0;
  for (const ch of seed) x = (x * 31 + ch.charCodeAt(0)) >>> 0;
  const angle = (x % 360) * (Math.PI / 180);
  const r = 0.0015 + ((x >>> 9) % 40) / 10000;
  return [Math.sin(angle) * r, Math.cos(angle) * r];
}

const kinds = loadKinds().filter((k) => k.status === "active");
const screens = loadScreens();
const places = loadPlaces().filter(
  (p) => p.status === "live" && ["city", "town", "village"].includes(p.type),
);

const usedBrandSlugs = new Set<string>();
const brands: SeedBrand[] = kinds.map((k) => {
  let slug = toSlug(screens[k.slug]!.brand.en ?? k.slug);
  if (usedBrandSlugs.has(slug)) slug = `${slug}-${k.slug}`;
  usedBrandSlugs.add(slug);
  return { slug, name: screens[k.slug]!.brand };
});
const brandOf = new Map(kinds.map((k, i) => [k.slug, brands[i]!.slug]));

const businesses: SeedBusinessRecord[] = [];
for (const place of places) {
  const kindSlugs = FLAGSHIP_CBS.has(place.cbsCode ?? "") ? kinds.map((k) => k.slug) : COMMON_KINDS;
  for (const slug of kindSlugs) {
    const kind = kinds.find((k) => k.slug === slug);
    if (!kind) throw new Error(`COMMON_KINDS has unknown kind ${slug}`);
    const screen = screens[slug]!;
    const [dLat, dLng] = jitter(`${place.slug}/${slug}`);
    businesses.push({
      slug: brandOf.get(slug)!,
      place: place.slug,
      brand: brandOf.get(slug)!,
      primaryKind: slug,
      kinds: [slug],
      name: screen.brand,
      tagline: screen.subtitle ?? screen.title,
      address: place.name,
      lat: Number((place.lat + dLat).toFixed(6)),
      lng: Number((place.lng + dLng).toFixed(6)),
      hours: slug === "mosques" ? MOSQUE_HOURS : (HOURS[kind.template] ?? DEFAULT_HOURS),
      attributes: kind.attributes.includes("delivers") ? { delivers: true } : {},
      tier: "example",
    });
  }
}

const out = (file: string, data: unknown) =>
  writeFileSync(new URL(`../data/${file}`, import.meta.url), `${JSON.stringify(data, null, 2)}\n`);
out("brands.json", brands);
writeFileSync(
  new URL("../data/businesses.json", import.meta.url),
  `[\n${businesses.map((r) => JSON.stringify(r)).join(",\n")}\n]\n`,
);
console.log(`${brands.length} brands, ${businesses.length} businesses in ${places.length} places`);
