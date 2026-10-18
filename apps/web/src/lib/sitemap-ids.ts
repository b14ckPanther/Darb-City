import { LOCALES, type Locale } from "@darb/core";

/**
 * Darb's sitemaps: per language, one of pages (home, legal, places, sectors, kinds) and as many as
 * needed of businesses, a slice each, so no response grows past what a crawler or a function
 * comfortably serves. Ids are language × 100 + slice: 0 is Hebrew pages, 1 the first Hebrew
 * businesses, 100 Arabic pages and so on.
 */
export const BUSINESSES_PER_SITEMAP = 2500;

export function sitemapIds(businesses: number): number[] {
  const slices = Math.ceil(businesses / BUSINESSES_PER_SITEMAP);
  return LOCALES.flatMap((_, l) => [
    l * 100,
    ...Array.from({ length: slices }, (_, s) => l * 100 + s + 1),
  ]);
}

export function readSitemapId(id: number): { locale: Locale; slice: number } {
  return { locale: LOCALES[Math.floor(id / 100)] ?? "he", slice: id % 100 };
}
