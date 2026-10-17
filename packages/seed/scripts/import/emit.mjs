// Records in the SeedBusiness shape (packages/seed/src/types.ts) and the data/listings/<source>.json
// files they live in.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { toSlug } from "@darb/core";
import { plainDashes } from "./names.mjs";

export const LISTINGS_DIR = new URL("../../data/listings/", import.meta.url);

/** Darb's forest and gold station palette (the Paz screens), with the chain's own accent. */
export const FOREST = { bg: "#0E1B15", surface: "#172A21", ink: "#F6EFE0" };
export const palette = (accent) => ({ ...FOREST, accent: accent.toUpperCase() });

export const ALWAYS_OPEN = {
  weekly: Object.fromEntries(
    [0, 1, 2, 3, 4, 5, 6].map((d) => [String(d), [{ open: "00:00", close: "24:00" }]]),
  ),
  exceptions: [],
};
export const NO_HOURS = { weekly: {}, exceptions: [] };

/** Every listing file but `except`, for duplicates against what is already published. */
export function readListings({ except } = {}) {
  const out = [];
  for (const file of readdirSync(LISTINGS_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort()) {
    if (file === except) continue;
    out.push(...JSON.parse(readFileSync(new URL(file, LISTINGS_DIR), "utf8")).businesses);
  }
  return out;
}

/** prefix + latinised name ("sonol" + "Sonol Akko North" is "sonol-akko-north"). */
export function slugBase(prefix, en) {
  const prefixSlug = prefix ? toSlug(prefix) : "";
  let rest = toSlug(en || "branch");
  if (prefixSlug && (rest === prefixSlug || rest.startsWith(`${prefixSlug}-`)))
    rest = rest.slice(prefixSlug.length + 1);
  return [prefixSlug, rest].filter(Boolean).join("-");
}

/** Slugs taken per place: `${place}/${slug}`. */
export function createSlugger(taken = []) {
  const used = new Set(taken);
  /** prefix + latinised name, unique in its place ("sonol-karmiel", "sonol-karmiel-2"). */
  return function slugFor(place, prefix, en) {
    const base = slugBase(prefix, en);
    let slug = base;
    for (let n = 2; used.has(`${place}/${slug}`); n++) slug = `${base}-${n}`;
    used.add(`${place}/${slug}`);
    return slug;
  };
}

/**
 * Makes the kept records' slugs unique in their place, after duplicates are gone, so a dropped
 * twin never leaves its partner as "-2". Each record's `slug` holds its base until then.
 */
export function assignSlugs(businesses, existing = []) {
  const slugFor = createSlugger(existing.map((b) => `${b.place}/${b.slug}`));
  for (const b of businesses) b.slug = slugFor(b.place, "", b.slug);
  return businesses;
}

const clean = (localized) =>
  Object.fromEntries(Object.entries(localized).map(([l, v]) => [l, plainDashes(v)]));
const cleanItem = (item) => ({
  label: clean(item.label),
  ...(item.meta ? { meta: clean(item.meta) } : {}),
});

/**
 * One basic listing. `screen` is { title, items, cta, accent }; the brand line of the screen is
 * the business's own name, as on the Paz cards.
 */
export function business({
  slug,
  place,
  brand = null,
  kinds,
  name,
  tagline,
  address,
  lat,
  lng,
  hours = NO_HOURS,
  attributes = {},
  phone = null,
  website = null,
  links = {},
  screen,
  accent,
}) {
  return {
    slug,
    place,
    brand,
    primaryKind: kinds[0],
    kinds,
    name: clean(name),
    tagline: clean(tagline),
    address: clean(address),
    lat: Number(lat.toFixed(7)),
    lng: Number(lng.toFixed(7)),
    hours,
    attributes: { primaryAction: "directions", ...attributes },
    tier: "basic",
    phone,
    whatsapp: null,
    website,
    apps: {},
    experience: {
      brand: clean(name),
      title: clean(screen.title),
      items: screen.items.map(cleanItem),
      cta: clean(screen.cta),
      palette: palette(accent),
      font: "Heebo",
    },
    links,
    cardStyle: { accent, icons: "solid" },
  };
}

/** Writes data/listings/<file> with its source block, businesses ordered by place then slug. */
export function writeListing(file, source, businesses) {
  mkdirSync(LISTINGS_DIR, { recursive: true });
  const sorted = [...businesses].sort(
    (a, b) => a.place.localeCompare(b.place) || a.slug.localeCompare(b.slug),
  );
  writeFileSync(
    new URL(file, LISTINGS_DIR),
    `${JSON.stringify({ source, businesses: sorted }, null, 2)}\n`,
  );
  return sorted.length;
}

const BRANDS = new URL("../../data/brands.json", import.meta.url);
/** Adds brands ({ slug, name }) data/brands.json does not have yet; never changes one it has. */
export function ensureBrands(brands) {
  const all = JSON.parse(readFileSync(BRANDS, "utf8"));
  const have = new Set(all.map((b) => b.slug));
  const added = brands
    .filter((b) => !have.has(b.slug))
    .map((b) => ({ slug: b.slug, name: b.name }));
  if (added.length) writeFileSync(BRANDS, `${JSON.stringify([...all, ...added], null, 2)}\n`);
  return added.length;
}
