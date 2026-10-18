import { pickText, type Locale } from "@darb/core";
import type { BusinessSummaryDto, PlaceDetailDto, SectorDto } from "@darb/contracts";
import type { StageLevel, StagePlace } from "@darb/stage";
import { pinsFromRows } from "./map-pins";
import { href, paths } from "./routes";
import { toRows, type BusinessRowData, type RowContext } from "./rows";
import type { TaxonomyIndex } from "./taxonomy";

/** Every door and pin href below equals the href of the list door or row it mirrors. */
export const COUNTRY_STAGE: StageLevel = { depth: 0 };

const stagePlace = (locale: Locale, place: PlaceDetailDto): StagePlace => ({
  slug: place.slug,
  name: pickText(place.name, locale),
  lat: place.lat,
  lng: place.lng,
});

export function placeStage(
  locale: Locale,
  place: PlaceDetailDto,
  index: TaxonomyIndex,
  totals: Map<string, number>,
): StageLevel {
  return {
    depth: 1,
    place: stagePlace(locale, place),
    doors: index.sectors.map((s) => ({
      slug: s.slug,
      href: href(locale, paths.sector(place.slug, s.slug)),
      label: pickText(s.name, locale),
      count: totals.get(s.slug) ?? 0,
      accent: s.accent,
    })),
  };
}

export function sectorStage(
  locale: Locale,
  place: PlaceDetailDto,
  sector: SectorDto,
  index: TaxonomyIndex,
  counts: Record<string, number>,
): StageLevel {
  return {
    depth: 2,
    place: stagePlace(locale, place),
    sector: { slug: sector.slug, name: pickText(sector.name, locale), accent: sector.accent },
    doors: (index.doorsBySector.get(sector.id) ?? []).map((k) => ({
      slug: k.slug,
      href: href(locale, paths.kind(place.slug, sector.slug, k.slug)),
      label: pickText(k.name, locale),
      count: counts[k.slug] ?? 0,
      accent: sector.accent,
    })),
  };
}

export function kindStage(
  locale: Locale,
  place: PlaceDetailDto,
  items: readonly BusinessSummaryDto[],
  ctx: RowContext,
): StageLevel {
  return {
    depth: 3,
    place: stagePlace(locale, place),
    pins: pinsFromRows(toRows(items, ctx)),
  };
}

/** Search results on the map (decision 6): at the searched place, else around the first result. */
export function searchStage(
  place: StagePlace | null,
  rows: readonly BusinessRowData[],
  title?: string,
): StageLevel {
  const named = title ? { title, count: rows.length } : {};
  if (place) return { depth: 3, place, pins: pinsFromRows(rows), ...named };
  if (rows.length === 0) return COUNTRY_STAGE;
  // Nationwide: no one city; the camera frames every pin (cameraFor fits their bounds).
  const mean = (pick: (r: BusinessRowData) => number) =>
    rows.reduce((sum, r) => sum + pick(r), 0) / rows.length;
  return {
    depth: 3,
    place: { slug: "", name: "", lat: mean((r) => r.lat), lng: mean((r) => r.lng) },
    pins: pinsFromRows(rows),
    ...named,
  };
}

export function soonStage(locale: Locale, place: PlaceDetailDto): StageLevel {
  return { depth: 3, place: stagePlace(locale, place), pins: [] };
}
