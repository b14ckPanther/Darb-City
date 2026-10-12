import { pickText, type Locale, type Localized } from "@darb/core";
import type { KindDto, PlaceDetailDto, SectorDto } from "@darb/contracts";
import { t } from "@darb/i18n";
import { href, paths } from "./routes";

export interface Crumb {
  label: string;
  href: string;
}

export interface CrumbTarget {
  place?: PlaceDetailDto;
  sector?: SectorDto;
  kind?: KindDto;
  business?: { slug: string; name: Localized };
  nationalKind?: KindDto;
  page?: Crumb;
}

/** Israel ▸ (parent city) ▸ place ▸ sector ▸ kind ▸ business. Regions are not steps people take. */
export function crumbsFor(locale: Locale, at: CrumbTarget): Crumb[] {
  const crumbs: Crumb[] = [{ label: t(locale, "country"), href: href(locale) }];
  if (at.page) return [...crumbs, at.page];
  if (at.nationalKind) {
    crumbs.push({
      label: pickText(at.nationalKind.name, locale),
      href: href(locale, paths.nationalKind(at.nationalKind.slug)),
    });
    return crumbs;
  }
  const { place, sector, kind, business } = at;
  if (!place) return crumbs;
  for (const a of place.ancestors) {
    if (a.type === "country" || a.type === "region") continue;
    crumbs.push({ label: pickText(a.name, locale), href: href(locale, paths.place(a.slug)) });
  }
  if (place.type !== "country") {
    crumbs.push({
      label: pickText(place.name, locale),
      href: href(locale, paths.place(place.slug)),
    });
  }
  if (!sector) return crumbs;
  crumbs.push({
    label: pickText(sector.name, locale),
    href: href(locale, paths.sector(place.slug, sector.slug)),
  });
  if (!kind) return crumbs;
  const kindPath = paths.kind(place.slug, sector.slug, kind.slug);
  crumbs.push({ label: pickText(kind.name, locale), href: href(locale, kindPath) });
  if (business) {
    crumbs.push({
      label: pickText(business.name, locale),
      href: href(locale, [...kindPath, business.slug]),
    });
  }
  return crumbs;
}
