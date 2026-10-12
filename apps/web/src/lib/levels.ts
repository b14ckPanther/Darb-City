import { notFound, permanentRedirect } from "next/navigation";
import type { Locale } from "@darb/core";
import type { PlaceDetailDto, SectorDto } from "@darb/contracts";
import { getPlace, getTaxonomy } from "./api";
import { isLocale } from "./locale";
import { href } from "./routes";
import { indexTaxonomy, type TaxonomyIndex } from "./taxonomy";

/** The root of the place tree. `/israel` redirects to `/`. */
export const COUNTRY_SLUG = "israel";

export function localeOrNotFound(value: string): Locale {
  if (!isLocale(value)) notFound();
  return value;
}

export interface PlaceLevel {
  locale: Locale;
  place: PlaceDetailDto;
  index: TaxonomyIndex;
}
export interface SectorLevel extends PlaceLevel {
  sector: SectorDto;
}

export async function loadPlaceLevel(raw: { locale: string; place: string }): Promise<PlaceLevel> {
  const locale = localeOrNotFound(raw.locale);
  if (raw.place === COUNTRY_SLUG) permanentRedirect(href(locale));
  const [place, taxonomy] = await Promise.all([getPlace(raw.place), getTaxonomy()]);
  if (!place) notFound();
  return { locale, place, index: indexTaxonomy(taxonomy) };
}

export async function loadSectorLevel(raw: {
  locale: string;
  place: string;
  sector: string;
}): Promise<SectorLevel> {
  const level = await loadPlaceLevel(raw);
  const sector = level.index.sectorBySlug.get(raw.sector);
  if (!sector) notFound();
  return { ...level, sector };
}
