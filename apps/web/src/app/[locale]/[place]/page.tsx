import type { Metadata } from "next";
import Link from "next/link";
import { pickText } from "@darb/core";
import { t } from "@darb/i18n";
import { CityBar } from "@/components/CityBar";
import { Door, DoorGrid } from "@/components/Door";
import { PlaceIndex } from "@/components/PlaceIndex";
import { SubPlaceChips } from "@/components/SubPlaceChips";
import { getKindCounts, getNearestPlace } from "@/lib/api";
import { crumbsFor, subPlaceChips } from "@/lib/crumbs";
import { formatNumber } from "@/lib/format";
import { loadPlaceLevel } from "@/lib/levels";
import { pageMetadata } from "@/lib/metadata";
import { href, paths } from "@/lib/routes";
import { sectorTotals } from "@/lib/taxonomy";
import { metadataOrUnavailable, orUnavailable } from "@/lib/unavailable";

export const revalidate = 300;
export function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ locale: string; place: string }> };

export const generateMetadata = metadataOrUnavailable(async function metadata({
  params,
}: Props): Promise<Metadata> {
  const { locale, place } = await loadPlaceLevel(await params);
  const name = pickText(place.name, locale);
  return pageMetadata({
    locale,
    segments: paths.place(place.slug),
    title: name,
    description: `${name} — ${t(locale, "tagline")}`,
  });
});

export default orUnavailable(async function PlacePage({ params }: Props) {
  const { locale, place, index } = await loadPlaceLevel(await params);
  const name = pickText(place.name, locale);
  const bar = (
    <CityBar
      locale={locale}
      crumbs={crumbsFor(locale, { place })}
      segments={paths.place(place.slug)}
    />
  );

  if (place.status === "soon") {
    const nearest = await getNearestPlace(place.lat, place.lng, "cached");
    return (
      <>
        {bar}
        <main id="main" className="frame reveal">
          <h1 id="main-heading" tabIndex={-1} className="page-title">
            {name}
          </h1>
          <p className="lede">{t(locale, "placeSoon", { place: name })}</p>
          {nearest ? (
            <p>
              <Link className="button-link" href={href(locale, paths.place(nearest.slug))}>
                {t(locale, "nearestLive", { place: pickText(nearest.name, locale) })}
              </Link>
            </p>
          ) : null}
        </main>
      </>
    );
  }

  const totals = sectorTotals(index, (await getKindCounts(place.slug)) ?? {});
  const chips = subPlaceChips(locale, place, []);
  const settlements =
    place.type === "region"
      ? place.children.filter((c) => c.status === "live" && c.type !== "neighbourhood")
      : [];
  return (
    <>
      {bar}
      <main id="main" className="frame reveal">
        <h1 id="main-heading" tabIndex={-1} className="page-title">
          {name}
        </h1>
        {chips.length > 0 ? (
          <SubPlaceChips label={t(locale, "neighbourhoods")} chips={chips} />
        ) : null}
        <DoorGrid label={t(locale, "allKinds")}>
          {index.sectors.map((sector) => {
            const count = totals.get(sector.slug) ?? 0;
            const countText = formatNumber(count, locale);
            return (
              <Door
                key={sector.slug}
                slug={sector.slug}
                href={href(locale, paths.sector(place.slug, sector.slug))}
                label={pickText(sector.name, locale)}
                sublabel={pickText(sector.tagline, locale)}
                count={count}
                countText={countText}
                countLabel={t(locale, "businessCount", { count: countText })}
                accent={sector.accent}
              />
            );
          })}
        </DoorGrid>
        {settlements.length > 0 ? (
          <PlaceIndex locale={locale} regions={[{ slug: place.slug, name, places: settlements }]} />
        ) : null}
      </main>
    </>
  );
});
