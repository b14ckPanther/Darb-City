import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { pickText } from "@darb/core";
import { t } from "@darb/i18n";
import { rowLabels } from "@/components/BusinessList";
import { KindResults } from "@/components/KindResults";
import { NoneYet } from "@/components/NoneYet";
import { StageData } from "@/components/StageData";
import { SubPlaceChips } from "@/components/SubPlaceChips";
import { getBusinesses, getNearestPlacesWithKind } from "@/lib/api";
import { subPlaceChips } from "@/lib/crumbs";
import { formatKm } from "@/lib/format";
import { loadKindLevelInSector } from "@/lib/levels";
import { href, paths } from "@/lib/routes";
import { placeNames, toRows } from "@/lib/rows";
import { kindStage } from "@/lib/stage-data";
import { orUnavailable } from "@/lib/unavailable";

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string; place: string; sector: string; kind: string }>;
};

/**
 * The list is a layout so it stays mounted under the level 4 sheet. Pages render the city bar
 * (`children`, before the list) so the locale switch can keep the full path.
 */
export default orUnavailable(async function KindLayout({ children, params }: Props) {
  const level = await loadKindLevelInSector(await params);
  // A wrong sector: the page (which knows the business segment) redirects.
  if (!level) return children;
  const { locale, place, sector, kind, index } = level;
  const page = await getBusinesses(place.slug, { kind: kind.slug });
  if (!page) notFound();
  const ctx = {
    locale,
    index,
    names: placeNames(place),
    here: place.slug,
    kmLabel: (km: number) => formatKm(km, locale),
  };
  const rows = toRows(page.items, ctx);
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
            <KindResults
              locale={locale}
              place={place.slug}
              kind={kind.slug}
              stagePlace={{ slug: place.slug, name: placeName, lat: place.lat, lng: place.lng }}
              initialRows={rows}
              initialCursor={page.nextCursor}
              deliversAvailable={kind.attributes.includes("delivers")}
              glutenFreeAvailable={sector.slug === "food"}
              labels={{
                businesses: t(locale, "businesses"),
                filters: t(locale, "filters"),
                openNow: t(locale, "openNow"),
                delivers: t(locale, "delivers"),
                glutenFree: t(locale, "glutenFree"),
                nearMe: t(locale, "nearMe"),
                locating: t(locale, "locating"),
                locationDenied: t(locale, "locationDenied"),
                showMore: t(locale, "showMore"),
                unreachable: t(locale, "unreachable"),
                filterNoResults: t(locale, "filterNoResults"),
                nothingOpen: t(locale, "nothingOpen"),
                includeClosed: t(locale, "includeClosed"),
                rows: rowLabels(locale),
              }}
            />
          ) : (
            <>
              <StageData level={kindStage(locale, place, page.items, ctx)} />
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
            </>
          )}
        </div>
      </main>
    </>
  );
});
