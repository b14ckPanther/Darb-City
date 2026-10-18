import type { Metadata } from "next";
import { pickText } from "@darb/core";
import { t } from "@darb/i18n";
import { CityBar } from "@/components/CityBar";
import { KindRows } from "@/components/Categories";
import { StageData } from "@/components/StageData";
import { SubPlaceChips } from "@/components/SubPlaceChips";
import { getKindCounts, getPlaceCounts } from "@/lib/api";
import { kindRows } from "@/lib/categories";
import { crumbsFor, subPlaceChips } from "@/lib/crumbs";
import { formatNumber } from "@/lib/format";
import { loadSectorLevel } from "@/lib/levels";
import { pageMetadata } from "@/lib/metadata";
import { href, paths } from "@/lib/routes";
import { sectorStage } from "@/lib/stage-data";
import { withBusinessesTaxonomy } from "@/lib/visible";
import { metadataOrUnavailable, orUnavailable } from "@/lib/unavailable";
import styles from "@/components/Categories.module.css";

export const revalidate = 86400;
export function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ locale: string; place: string; sector: string }> };

export const generateMetadata = metadataOrUnavailable(async function metadata({
  params,
}: Props): Promise<Metadata> {
  const { locale, place, sector } = await loadSectorLevel(await params);
  return pageMetadata({
    locale,
    segments: paths.sector(place.slug, sector.slug),
    title: `${pickText(sector.name, locale)} · ${pickText(place.name, locale)}`,
    description: pickText(sector.tagline, locale),
  });
});

export default orUnavailable(async function SectorPage({ params }: Props) {
  const { locale, place, sector, index } = await loadSectorLevel(await params);
  const counts = (await getKindCounts(place.slug)) ?? {};
  const shown = withBusinessesTaxonomy(index, counts);
  const kinds = kindRows(locale, shown.doorsBySector.get(sector.id) ?? [], counts);
  const placeName = pickText(place.name, locale);
  const chips = subPlaceChips(locale, place, [sector.slug], await getPlaceCounts());
  return (
    <>
      <CityBar
        locale={locale}
        crumbs={crumbsFor(locale, { place, sector })}
        segments={paths.sector(place.slug, sector.slug)}
      />
      <StageData level={sectorStage(locale, place, sector, shown, counts)} />
      <main id="main" className="frame reveal">
        <h1 id="main-heading" tabIndex={-1} className="page-title">
          {pickText(sector.name, locale)}
        </h1>
        <p className="lede">{pickText(sector.tagline, locale)}</p>
        {chips.length > 0 ? (
          <SubPlaceChips label={t(locale, "neighbourhoods")} chips={chips} />
        ) : null}
        {kinds.length > 0 ? (
          <div className={styles.groups}>
            <KindRows
              kinds={kinds}
              href={(kind) => href(locale, paths.kind(place.slug, sector.slug, kind))}
              accent={sector.accent}
              countText={(n) => formatNumber(n, locale)}
              countLabel={(n) => t(locale, "businessCount", { count: formatNumber(n, locale) })}
              preview={{
                place: place.slug,
                title: (kind) => t(locale, "kindInPlace", { kind, place: placeName }),
                onMap: (kind) => t(locale, "showOnMap", { kind }),
              }}
              doors
              label={pickText(sector.name, locale)}
              card
            />
          </div>
        ) : null}
        {kinds.length === 0 ? <p className="lede">{t(locale, "nothingListedYet")}</p> : null}
      </main>
    </>
  );
});
