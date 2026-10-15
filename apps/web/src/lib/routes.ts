import { LOCALES, type Locale } from "@darb/core";

/** A locale's URL for path segments. Slugs are URL-safe, so they are joined as they are. */
export function href(locale: Locale, segments: readonly string[] = []): string {
  const prefix = locale === "he" ? "" : `/${locale}`;
  if (segments.length === 0) return prefix === "" ? "/" : prefix;
  return `${prefix}/${segments.join("/")}`;
}

export const paths = {
  home: (): string[] => [],
  place: (place: string) => [place],
  sector: (place: string, sector: string) => [place, sector],
  kind: (place: string, sector: string, kind: string) => [place, sector, kind],
  business: (place: string, sector: string, kind: string, business: string) => [
    place,
    sector,
    kind,
    business,
  ],
  /**
   * A business opened from the listed place's kind list, so the list stays behind the sheet. Slugs
   * are unique per place only, so a business from beneath the listed place keeps its own place.
   */
  listedBusiness: (listed: string, sector: string, kind: string, own: string, business: string) =>
    own === listed ? [listed, sector, kind, business] : [listed, sector, kind, own, business],
  nationalKind: (kind: string) => ["k", kind],
  placeKind: (place: string, kind: string) => [place, "k", kind],
  forBusiness: () => ["for-business"],
  accessibility: () => ["accessibility"],
  terms: () => ["terms"],
  privacy: () => ["privacy"],
  search: () => ["search"],
};

export function languageAlternates(segments: readonly string[]): Record<string, string> {
  return {
    ...Object.fromEntries(LOCALES.map((l) => [l, href(l, segments)])),
    "x-default": href("he", segments),
  };
}
