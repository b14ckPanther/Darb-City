import type { Page, TestInfo } from "@playwright/test";

export const LOCALES = ["he", "ar", "en"] as const;
export type Locale = (typeof LOCALES)[number];

/** `/sakhnin` in a locale: unprefixed for Hebrew. */
export function localePath(locale: Locale, path: string): string {
  if (locale === "he") return path;
  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}

/** Sakhnin is a flagship: it has one example business of every active kind. */
export const LEVELS = {
  /** The country's place and kind index (the landing page took the root). */
  country: "/israel",
  place: "/sakhnin",
  sector: "/sakhnin/beauty",
  kind: "/sakhnin/beauty/barbershops",
  business: "/sakhnin/beauty/barbershops/samers-barbershop",
  nationalKind: "/k/barbershops",
} as const;
/** Pages outside the city: no stage, the site footer (STAGE_EXCLUDED in src/lib/stage-boot.ts). */
export const SITE_PAGES = [
  "/",
  "/showroom",
  "/pricing",
  "/contact",
  "/join",
  "/near",
  "/for-business",
  "/accessibility",
  "/terms",
  "/privacy",
] as const;
export const BUSINESS_KEY = "sakhnin/samers-barbershop";

/**
 * Haifa's lists include its neighbourhood Kiryat Haim, whose showroom businesses share Haifa's
 * slugs, so a Kiryat Haim row opens under Haifa with its own place named in the path.
 */
export const HAIFA = {
  kind: "/en/haifa/beauty/barbershops",
  subPlaceBusiness: "/en/haifa/beauty/barbershops/kiryat-haim/samers-barbershop",
  subPlaceKey: "kiryat-haim/samers-barbershop",
} as const;

/** Arraba has only the 16 common kinds, so it has no nails salon. */
export const EMPTY_KIND = "/arraba/beauty/nails";
/** Perla Nails exists in Sakhnin, never in Arraba. */
export const OTHER_PLACE_BUSINESS = "/arraba/beauty/nails/perla-nails";
export const ARRABA = { latitude: 32.8486259, longitude: 35.3358268 };

export const isPhone = (info: TestInfo) => info.project.name === "phone";

/** A second `next start` on the same build whose API is unreachable (see playwright.config.ts). */
export const WEB_API_DOWN = process.env.WEB_API_DOWN_URL ?? "http://localhost:3101";

/**
 * Waits for the lazy stage: settled on desktop (or an open phone stage), mounted behind its pill on
 * a closed phone, or off (no WebGL2, failed, or a page outside the city).
 */
export async function settleStage(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const d = document.documentElement;
      if (d.getAttribute("data-stage") !== "on") return true;
      const host = document.querySelector("[data-stage-host]");
      if (innerWidth < 900 && !d.hasAttribute("data-stage-open")) return host !== null;
      return (
        host?.getAttribute("data-stage-state") === "ready" &&
        !host.hasAttribute("data-stage-moving")
      );
    },
    null,
    { timeout: 30_000 },
  );
}
