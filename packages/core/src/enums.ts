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
