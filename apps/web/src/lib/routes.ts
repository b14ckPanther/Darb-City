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
  nationalKind: (kind: string) => ["k", kind],
  placeKind: (place: string, kind: string) => [place, "k", kind],
  forBusiness: () => ["for-business"],
  search: () => ["search"],
};

export function languageAlternates(segments: readonly string[]): Record<string, string> {
  return {
    ...Object.fromEntries(LOCALES.map((l) => [l, href(l, segments)])),
    "x-default": href("he", segments),
  };
}
