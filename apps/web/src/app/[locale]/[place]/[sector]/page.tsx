import type { Metadata } from "next";
import { pickText } from "@darb/core";
import { t } from "@darb/i18n";
import { CityBar } from "@/components/CityBar";
import { Door, DoorGrid } from "@/components/Door";
import { SubPlaceChips } from "@/components/SubPlaceChips";
import { getKindCounts } from "@/lib/api";
import { crumbsFor, subPlaceChips } from "@/lib/crumbs";
import { formatNumber } from "@/lib/format";
import { loadSectorLevel } from "@/lib/levels";
import { pageMetadata } from "@/lib/metadata";
import { href, paths } from "@/lib/routes";

export const revalidate = 300;
export function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ locale: string; place: string; sector: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, place, sector } = await loadSectorLevel(await params);
  return pageMetadata({
    locale,
    segments: paths.sector(place.slug, sector.slug),
    title: `${pickText(sector.name, locale)} · ${pickText(place.name, locale)}`,
    description: pickText(sector.tagline, locale),
  });
}

export default async function SectorPage({ params }: Props) {
  const { locale, place, sector, index } = await loadSectorLevel(await params);
  const counts = (await getKindCounts(place.slug)) ?? {};
  const chips = subPlaceChips(locale, place, [sector.slug]);
  return (
    <>
      <CityBar
        locale={locale}
        crumbs={crumbsFor(locale, { place, sector })}
        segments={paths.sector(place.slug, sector.slug)}
      />
      <main id="main" className="frame reveal">
        <h1 id="main-heading" tabIndex={-1} className="page-title">
          {pickText(sector.name, locale)}
        </h1>
        <p className="lede">{pickText(sector.tagline, locale)}</p>
        {chips.length > 0 ? (
          <SubPlaceChips label={t(locale, "neighbourhoods")} chips={chips} />
        ) : null}
        <DoorGrid label={pickText(sector.name, locale)}>
          {(index.doorsBySector.get(sector.id) ?? []).map((kind) => {
            const count = counts[kind.slug] ?? 0;
            const countText = formatNumber(count, locale);
            return (
              <Door
                key={kind.slug}
                slug={kind.slug}
                href={href(locale, paths.kind(place.slug, sector.slug, kind.slug))}
                label={pickText(kind.name, locale)}
                count={count}
                countText={countText}
                countLabel={t(locale, "businessCount", { count: countText })}
                accent={sector.accent}
              />
            );
          })}
        </DoorGrid>
      </main>
    </>
  );
}
