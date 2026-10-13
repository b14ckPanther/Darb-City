export const TEMPLATES = [
  "menu",
  "booking",
  "shop",
  "portfolio",
  "listing",
  "schedule",
  "quote",
  "donate",
  "tracker",
  "pass",
  "builder",
] as const;
export type Template = (typeof TEMPLATES)[number];

export const PLACE_TYPES = [
  "country",
  "region",
  "city",
  "town",
  "village",
  "neighbourhood",
] as const;
export type PlaceType = (typeof PLACE_TYPES)[number];

export const PLACE_STATUSES = ["live", "soon"] as const;
export type PlaceStatus = (typeof PLACE_STATUSES)[number];

export const TIERS = ["example", "basic", "verified", "darb"] as const;
export type Tier = (typeof TIERS)[number];

/**
 * Dietary facts about a whole business, never about one dish: `gluten_free` means the entire
 * kitchen and menu are gluten-free (safe for celiac disease), not "has a gluten-free option".
 * A new value is one line here plus `ALTER TYPE "Dietary" ADD VALUE` in a migration.
 */
export const DIETARY = ["gluten_free"] as const;
export type Dietary = (typeof DIETARY)[number];
