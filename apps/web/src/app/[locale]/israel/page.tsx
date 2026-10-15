import type { Metadata } from "next";
import { pickText } from "@darb/core";
import { t } from "@darb/i18n";
import { CityBar } from "@/components/CityBar";
import { KindIndex, PlaceIndex } from "@/components/PlaceIndex";
import { StageData } from "@/components/StageData";
import { getPlace, getPlaces, getTaxonomy } from "@/lib/api";
import { crumbsFor } from "@/lib/crumbs";
import { COUNTRY_SLUG, localeOrNotFound } from "@/lib/levels";
import { pageMetadata } from "@/lib/metadata";
import { paths } from "@/lib/routes";
import { COUNTRY_STAGE } from "@/lib/stage-data";
import { indexTaxonomy } from "@/lib/taxonomy";
import { metadataOrUnavailable, orUnavailable } from "@/lib/unavailable";

export const revalidate = 86400;
export function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ locale: string }> };

export const generateMetadata = metadataOrUnavailable(async function metadata({
  params,
}: Props): Promise<Metadata> {
  const locale = localeOrNotFound((await params).locale);
  return pageMetadata({
    locale,
    segments: paths.explore(),
    title: t(locale, "country"),
    description: t(locale, "tagline"),
  });
});

/** The whole country: every region's places and every kind (the landing page has the root). */
export default orUnavailable(async function CountryPage({ params }: Props) {
  const locale = localeOrNotFound((await params).locale);
  const [country, places, taxonomy] = await Promise.all([
    getPlace(COUNTRY_SLUG),
    getPlaces("live"),
    getTaxonomy(),
  ]);
  const regions = (country?.children ?? [])
    .filter((r) => r.type === "region" && r.status === "live")
    .map((r) => ({
      slug: r.slug,
      name: pickText(r.name, locale),
      places: places.filter((p) => p.parentId === r.id),
    }))
    .filter((r) => r.places.length > 0);
  return (
    <>
      <StageData level={COUNTRY_STAGE} />
      <CityBar locale={locale} crumbs={crumbsFor(locale, {})} segments={paths.explore()} />
      <main id="main" className="frame reveal">
        <h1 id="main-heading" tabIndex={-1} className="page-title">
          {t(locale, "tagline")}
        </h1>
        <PlaceIndex locale={locale} regions={regions} />
        <KindIndex locale={locale} index={indexTaxonomy(taxonomy)} />
      </main>
    </>
  );
});
