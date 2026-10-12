import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { pickText } from "@darb/core";
import { t } from "@darb/i18n";
import { BusinessList } from "@/components/BusinessList";
import { NoneYet } from "@/components/NoneYet";
import { SubPlaceChips } from "@/components/SubPlaceChips";
import { getBusinesses, getNearestPlacesWithKind } from "@/lib/api";
import { subPlaceChips } from "@/lib/crumbs";
import { formatKm } from "@/lib/format";
import { loadKindLevel } from "@/lib/levels";
import { href, paths } from "@/lib/routes";
import { placeNames, toRows } from "@/lib/rows";

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string; place: string; sector: string; kind: string }>;
};

/**
 * The list is a layout so it stays mounted under the level 4 sheet. Pages render the city bar
 * (`children`, before the list) so the locale switch can keep the full path.
 */
export default async function KindLayout({ children, params }: Props) {
  const { locale, place, sector, kind, index } = await loadKindLevel(await params);
  const page = await getBusinesses(place.slug, { kind: kind.slug });
  if (!page) notFound();
  const rows = toRows(page.items, { locale, index, names: placeNames(place), here: place.slug });
  const placeName = pickText(place.name, locale);
  const nearest =
    rows.length === 0
      ? ((await getNearestPlacesWithKind(kind.slug, place.lat, place.lng, 5)) ?? [])
      : [];
  const chips = subPlaceChips(locale, place, [sector.slug, kind.slug]);
  return (
    <>
      {children}
      <main id="main" className="frame">
        <div id="city-list" className="reveal">
          <h1 id="main-heading" tabIndex={-1} className="page-title">
            {t(locale, "kindInPlace", { kind: pickText(kind.name, locale), place: placeName })}
          </h1>
          {chips.length > 0 ? (
            <SubPlaceChips label={t(locale, "neighbourhoods")} chips={chips} />
          ) : null}
          {rows.length > 0 ? (
            <BusinessList
              locale={locale}
              rows={rows}
              more={
                page.nextCursor
                  ? { place: place.slug, kind: kind.slug, cursor: page.nextCursor }
                  : null
              }
            />
          ) : (
            <NoneYet
              title={t(locale, "noneHereYet", { place: placeName })}
              subtitle={t(locale, "nearestPlaces")}
              places={nearest.map((p) => ({
                key: p.slug,
                name: pickText(p.name, locale),
                href: href(locale, paths.kind(p.slug, sector.slug, kind.slug)),
                distance: formatKm(p.distanceKm, locale),
              }))}
            />
          )}
        </div>
      </main>
    </>
  );
}
