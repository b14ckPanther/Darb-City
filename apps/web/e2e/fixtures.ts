import type { TestInfo } from "@playwright/test";

export const LOCALES = ["he", "ar", "en"] as const;
export type Locale = (typeof LOCALES)[number];

/** `/sakhnin` in a locale: unprefixed for Hebrew. */
export function localePath(locale: Locale, path: string): string {
  if (locale === "he") return path;
  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}

/** Sakhnin is a flagship: it has one example business of every active kind. */
export const LEVELS = {
  country: "/",
  place: "/sakhnin",
  sector: "/sakhnin/beauty",
  kind: "/sakhnin/beauty/barbershops",
  business: "/sakhnin/beauty/barbershops/samers-barbershop",
  nationalKind: "/k/barbershops",
} as const;
export const BUSINESS_KEY = "sakhnin/samers-barbershop";

/** Arraba has only the 16 common kinds, so it has no nails salon. */
export const EMPTY_KIND = "/arraba/beauty/nails";
/** Perla Nails exists in Sakhnin, never in Arraba. */
export const OTHER_PLACE_BUSINESS = "/arraba/beauty/nails/perla-nails";
export const ARRABA = { latitude: 32.8486259, longitude: 35.3358268 };

export const isPhone = (info: TestInfo) => info.project.name === "phone";

/** A second `next start` on the same build whose API is unreachable (see playwright.config.ts). */
export const WEB_API_DOWN = "http://localhost:3001";
