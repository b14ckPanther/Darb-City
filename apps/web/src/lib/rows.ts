import { pickText, type Locale, type Localized } from "@darb/core";
import type { BusinessSummaryDto, PlaceDetailDto, PlaceDto } from "@darb/contracts";
import { href, paths } from "./routes";
import type { TaxonomyIndex } from "./taxonomy";

/** A business row, already localized, so client components can render it too. */
export interface BusinessRowData {
  key: string;
  name: string;
  tagline: string;
  href: string;
  example: boolean;
  openNow: boolean | null;
  /** Shown when the business is in another place than the one being listed. */
  placeName: string | null;
  lat: number;
  lng: number;
  /** Shown on distance-sorted lists ("1.3 km"). */
  distance: string | null;
}

export interface RowContext {
  locale: Locale;
  index: TaxonomyIndex;
  names: Map<string, Localized>;
  /**
   * The place being listed: rows open under it (so its list stays behind the sheet) and rows from
   * beneath it name their place. Null lists everywhere, and rows open in their own place.
   */
  here: string | null;
  /** Formats distanceKm; server callers pass formatKm, so this file never imports @darb/i18n. */
  kmLabel?: (km: number) => string;
}

export function placeNames(place: PlaceDetailDto | null, places: readonly PlaceDto[] = []) {
  const names = new Map<string, Localized>(places.map((p) => [p.slug, p.name]));
  if (place) {
    names.set(place.slug, place.name);
    for (const child of place.children) names.set(child.slug, child.name);
  }
  return names;
}

export function toBusinessRow(b: BusinessSummaryDto, ctx: RowContext): BusinessRowData | null {
  const kind = ctx.index.kindById.get(b.primaryKindId);
  const sector = kind ? ctx.index.sectorById.get(kind.sectorId) : undefined;
  if (!kind || !sector) return null;
  const name = ctx.names.get(b.placeSlug);
  return {
    key: `${b.placeSlug}/${b.slug}`,
    name: pickText(b.name, ctx.locale),
    tagline: pickText(b.tagline, ctx.locale),
    href: href(
      ctx.locale,
      ctx.here
        ? paths.listedBusiness(ctx.here, sector.slug, kind.slug, b.placeSlug, b.slug)
        : paths.business(b.placeSlug, sector.slug, kind.slug, b.slug),
    ),
    example: b.tier === "example",
    openNow: b.openNow,
    placeName: b.placeSlug === ctx.here || !name ? null : pickText(name, ctx.locale),
    lat: b.lat,
    lng: b.lng,
    distance: b.distanceKm !== undefined && ctx.kmLabel ? ctx.kmLabel(b.distanceKm) : null,
  };
}

export function toRows(items: readonly BusinessSummaryDto[], ctx: RowContext): BusinessRowData[] {
  return items.flatMap((b) => {
    const row = toBusinessRow(b, ctx);
    return row ? [row] : [];
  });
}
