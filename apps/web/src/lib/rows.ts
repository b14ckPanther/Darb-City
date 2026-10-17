import { isByAppointment, pickText, type Hours, type Locale, type Localized } from "@darb/core";
import type { BusinessSummaryDto, PlaceDetailDto, PlaceDto } from "@darb/contracts";
import { MEDIA_ORIGIN } from "./csp";
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
  /** For the browser's own open-now (LiveOpenState); null when the business has no hours. */
  hours: Hours | null;
  /** Shown when the business is in another place than the one being listed. */
  placeName: string | null;
  lat: number;
  lng: number;
  /** Shown on distance-sorted lists ("1.3 km"). */
  distance: string | null;
  /** A fully gluten-free kitchen (Task 27b): the row shows a badge. */
  glutenFree: boolean;
  /** Visits by appointment only (Task 28): "By appointment" instead of open or closed. */
  byAppointment: boolean;
  /** The card's look, lightly: the owner's accent (else the sector's) and logo (a bucket URL). */
  accent: string;
  logoUrl: string | null;
  /** Search only: the thing on its card that answered ("Shawarma", "Challah sandwiches"). */
  matched?: { label: string; context: string | null } | null;
  /** Search only: the asked diet is a must, so its badge is highlighted. */
  strictGlutenFree?: boolean;
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
    hours: b.openNow === null ? null : b.hours,
    placeName: b.placeSlug === ctx.here || !name ? null : pickText(name, ctx.locale),
    lat: b.lat,
    lng: b.lng,
    distance: b.distanceKm !== undefined && ctx.kmLabel ? ctx.kmLabel(b.distanceKm) : null,
    glutenFree: b.dietary.includes("gluten_free"),
    byAppointment: isByAppointment(b.hours),
    accent: b.cardStyle?.accent ?? sector.accent,
    logoUrl: b.logo ? `${MEDIA_ORIGIN}/${b.logo.key}` : null,
  };
}

export function toRows(items: readonly BusinessSummaryDto[], ctx: RowContext): BusinessRowData[] {
  return items.flatMap((b) => {
    const row = toBusinessRow(b, ctx);
    return row ? [row] : [];
  });
}
