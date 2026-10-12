/** CBS codes of the spec §11 flagships: every active kind gets an example business there. */
export const FLAGSHIP_CBS: ReadonlySet<string> = new Set([
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

/** Flagships with no CBS code of their own (neighbourhoods), matched by slug. */
export const FLAGSHIP_SLUGS: ReadonlySet<string> = new Set(["kiryat-haim"]);

/** The kinds every other live settlement gets one example business of. */
export const COMMON_KINDS: readonly string[] = [
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
