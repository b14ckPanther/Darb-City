import { notFound, permanentRedirect, redirect } from "next/navigation";
import type { Locale } from "@darb/core";
import type { KindDto, PlaceDetailDto, SectorDto } from "@darb/contracts";
import { getPlace, getTaxonomy } from "./api";
import { isLocale } from "./locale";
import { href, paths } from "./routes";
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

export interface KindLevel extends SectorLevel {
  kind: KindDto;
}

type KindParams = { locale: string; place: string; sector: string; kind: string };

/** The kind and its own sector; a URL naming another sector is flagged, not redirected. */
async function resolveKindLevel(raw: KindParams): Promise<KindLevel | { wrongSector: KindLevel }> {
  const level = await loadPlaceLevel(raw);
  const kind = level.index.kindBySlug.get(raw.kind);
  if (!kind) notFound();
  const sector = level.index.sectorById.get(kind.sectorId);
  if (!sector) notFound();
  const resolved = { ...level, sector, kind };
  return sector.slug === raw.sector ? resolved : { wrongSector: resolved };
}

/** `rest` keeps deeper segments (the business) when a kind is redirected to its own sector. */
export async function loadKindLevel(
  raw: KindParams,
  rest: readonly string[] = [],
): Promise<KindLevel> {
  const resolved = await resolveKindLevel(raw);
  if ("wrongSector" in resolved) {
    const { locale, place, sector, kind } = resolved.wrongSector;
    redirect(href(locale, [...paths.kind(place.slug, sector.slug, kind.slug), ...rest]));
  }
  return resolved;
}

/**
 * For the kind layout: it cannot see the business segment, so it never redirects. A wrong sector
 * gives `null` and the layout renders only its page, which redirects with the full path.
 */
export async function loadKindLevelInSector(raw: KindParams): Promise<KindLevel | null> {
  const resolved = await resolveKindLevel(raw);
  return "wrongSector" in resolved ? null : resolved;
}

/**
 * Where `/{place}/k/{kind}` (search lands there without knowing the sector) goes: the canonical
 * kind URL, or the national kind page for the country. Unknown places and kinds are not found.
 */
export async function placeKindShortcut(raw: {
  locale: string;
  place: string;
  kind: string;
}): Promise<string> {
  const locale = localeOrNotFound(raw.locale);
  const country = raw.place === COUNTRY_SLUG;
  const [place, taxonomy] = await Promise.all([
    country ? null : getPlace(raw.place),
    getTaxonomy(),
  ]);
  if (!country && !place) notFound();
  const index = indexTaxonomy(taxonomy);
  const kind = index.kindBySlug.get(raw.kind);
  const sector = kind ? index.sectorById.get(kind.sectorId) : undefined;
  if (!kind || !sector) notFound();
  if (!place) return href(locale, paths.nationalKind(kind.slug));
  return href(locale, paths.kind(place.slug, sector.slug, kind.slug));
}
