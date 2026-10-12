import type { Hours } from "@darb/core";

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

/**
 * Arab and Druze localities: Saturday is a working day (Sunday's hours) and Friday closes at noon,
 * before the midday prayer. Weeks without Sunday hours are left as they are.
 */
export function toArabDruzeWeek(hours: Hours): Hours {
  const sunday = hours.weekly[0] ?? [];
  const first = sunday[0];
  if (!first) return hours;
  const friday = first.open < "12:00" ? [{ open: first.open, close: "12:00" }] : [];
  return {
    ...hours,
    weekly: { ...hours.weekly, 5: friday, 6: sunday.map((interval) => ({ ...interval })) },
  };
}

/**
 * Christian-majority villages: Saturday is a working day (Sunday's hours) and Sunday is closed.
 * Friday keeps the default. Weeks without Sunday hours are left as they are.
 */
export function toChristianWeek(hours: Hours): Hours {
  const sunday = hours.weekly[0] ?? [];
  if (sunday.length === 0) return hours;
  return {
    ...hours,
    weekly: { ...hours.weekly, 0: [], 6: sunday.map((interval) => ({ ...interval })) },
  };
}
