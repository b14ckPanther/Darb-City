import type { Metadata } from "next";
import Link from "next/link";
import { pickText } from "@darb/core";
import { t } from "@darb/i18n";
import { CityBar } from "@/components/CityBar";
import { KindRows, SectorGroup, Chevron } from "@/components/Categories";
import { PlaceIndex } from "@/components/PlaceIndex";
import { StageData } from "@/components/StageData";
import { SubPlaceChips } from "@/components/SubPlaceChips";
import { getKindCounts, getNearestPlace, getPlaceCounts } from "@/lib/api";
import { sectorGroups } from "@/lib/categories";
import { crumbsFor, subPlaceChips } from "@/lib/crumbs";
import { formatNumber } from "@/lib/format";
import { loadPlaceLevel } from "@/lib/levels";
import { pageMetadata } from "@/lib/metadata";
import { href, paths } from "@/lib/routes";
import { placeStage, soonStage } from "@/lib/stage-data";
import { sectorTotals } from "@/lib/taxonomy";
import { withBusinessesTaxonomy } from "@/lib/visible";
import styles from "@/components/Categories.module.css";
import { metadataOrUnavailable, orUnavailable } from "@/lib/unavailable";

export const revalidate = 86400;
/** A place's sector shows its busiest kinds; the rest are one tap away on the sector page. */
const TOP_KINDS = 5;
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
    description: `${name} | ${t(locale, "tagline")}`,
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
        <StageData level={soonStage(locale, place)} />
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

  const counts = (await getKindCounts(place.slug)) ?? {};
  const totals = sectorTotals(index, counts);
  const shown = withBusinessesTaxonomy(index, counts);
  const groups = sectorGroups(locale, shown, counts);
  const chips = subPlaceChips(locale, place, [], await getPlaceCounts());
  const settlements =
    place.type === "region"
      ? place.children.filter((c) => c.status === "live" && c.type !== "neighbourhood")
      : [];
  return (
    <>
      {bar}
      <StageData level={placeStage(locale, place, shown, totals)} />
      <main id="main" className="frame reveal">
        <h1 id="main-heading" tabIndex={-1} className="page-title">
          {name}
        </h1>
        {chips.length > 0 ? (
          <SubPlaceChips label={t(locale, "neighbourhoods")} chips={chips} />
        ) : null}
        <div className={styles.groups} role="group" aria-label={t(locale, "allKinds")}>
          {groups.map((group) => {
            const sectorHref = href(locale, paths.sector(place.slug, group.sector.slug));
            const totalText = formatNumber(group.total, locale);
            const hidden = group.kinds.length - TOP_KINDS;
            return (
              <SectorGroup
                key={group.sector.slug}
                slug={group.sector.slug}
                name={group.name}
                tagline={group.tagline}
                accent={group.sector.accent}
                href={sectorHref}
                totalText={totalText}
                totalLabel={t(locale, "businessCount", { count: totalText })}
              >
                <KindRows
                  kinds={hidden > 1 ? group.kinds.slice(0, TOP_KINDS) : group.kinds}
                  href={(kind) => href(locale, paths.kind(place.slug, group.sector.slug, kind))}
                  accent={group.sector.accent}
                  countText={(n) => formatNumber(n, locale)}
                  countLabel={(n) => t(locale, "businessCount", { count: formatNumber(n, locale) })}
                  preview={{
                    place: place.slug,
                    title: (kind) => t(locale, "kindInPlace", { kind, place: name }),
                    onMap: (kind) => t(locale, "showOnMap", { kind }),
                  }}
                  label={group.name}
                  more={
                    hidden > 1 ? (
                      <Link href={sectorHref} className={styles.more} data-more-kinds="">
                        {t(locale, "moreKinds", {
                          count: formatNumber(group.kinds.length, locale),
                        })}
                        <Chevron className={styles.chevron} />
                      </Link>
                    ) : null
                  }
                />
              </SectorGroup>
            );
          })}
        </div>
        {groups.length === 0 ? <p className="lede">{t(locale, "nothingListedYet")}</p> : null}
        {settlements.length > 0 ? (
          <PlaceIndex locale={locale} regions={[{ slug: place.slug, name, places: settlements }]} />
        ) : null}
      </main>
    </>
  );
});
