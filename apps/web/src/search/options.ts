import { pickText, type Locale } from "@darb/core";
import type { SuggestionDto } from "@darb/contracts";
import { href, paths } from "@/lib/routes";
import type { SearchOption } from "./types";

export function suggestionOptions(rows: readonly SuggestionDto[], locale: Locale): SearchOption[] {
  return rows.map((s) => ({
    id: `business:${s.placeSlug}/${s.slug}`,
    group: "businesses",
    label: pickText(s.name, locale),
    sublabel: pickText(s.placeName, locale),
    href: href(locale, paths.business(s.placeSlug, s.sectorSlug, s.kindSlug, s.slug)),
  }));
}
