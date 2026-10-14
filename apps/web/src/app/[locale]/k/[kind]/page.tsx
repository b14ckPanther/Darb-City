import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { pickText } from "@darb/core";
import { t } from "@darb/i18n";
import { BusinessList } from "@/components/BusinessList";
import { CityBar } from "@/components/CityBar";
import { NearMe } from "@/components/NearMe";
import { NoneYet } from "@/components/NoneYet";
import { StageData } from "@/components/StageData";
import { getBusinesses, getPlaces, getTaxonomy } from "@/lib/api";
import { crumbsFor } from "@/lib/crumbs";
import { COUNTRY_SLUG, localeOrNotFound } from "@/lib/levels";
import { pageMetadata } from "@/lib/metadata";
import { href, paths } from "@/lib/routes";
import { placeNames, toRows } from "@/lib/rows";
import { COUNTRY_STAGE } from "@/lib/stage-data";
import { indexTaxonomy } from "@/lib/taxonomy";
import { metadataOrUnavailable, orUnavailable } from "@/lib/unavailable";

export const revalidate = 86400;
export function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ locale: string; kind: string }> };

async function load(params: Props["params"]) {
  const raw = await params;
  const locale = localeOrNotFound(raw.locale);
  const index = indexTaxonomy(await getTaxonomy());
  const kind = index.kindBySlug.get(raw.kind);
  if (!kind) notFound();
  return { locale, index, kind };
}

export const generateMetadata = metadataOrUnavailable(async function metadata({
  params,
}: Props): Promise<Metadata> {
  const { locale, kind } = await load(params);
  return pageMetadata({
    locale,
    segments: paths.nationalKind(kind.slug),
    title: t(locale, "kindNationwide", { kind: pickText(kind.name, locale) }),
    description: t(locale, "tagline"),
  });
});

export default orUnavailable(async function NationalKindPage({ params }: Props) {
  const { locale, index, kind } = await load(params);
  const [page, places] = await Promise.all([
    getBusinesses(COUNTRY_SLUG, { kind: kind.slug }),
    getPlaces("live"),
  ]);
  if (!page) notFound();
  const rows = toRows(page.items, { locale, index, names: placeNames(null, places), here: null });
  return (
    <>
      <StageData level={COUNTRY_STAGE} />
      <CityBar
        locale={locale}
        crumbs={crumbsFor(locale, { nationalKind: kind })}
        segments={paths.nationalKind(kind.slug)}
      />
      <main id="main" className="frame">
        <div id="city-list" className="reveal">
          <h1 id="main-heading" tabIndex={-1} className="page-title">
            {t(locale, "kindNationwide", { kind: pickText(kind.name, locale) })}
          </h1>
          <NearMe
            locale={locale}
            kind={kind.slug}
            homeHref={href(locale)}
            labels={{
              nearMe: t(locale, "nearMe"),
              locating: t(locale, "locating"),
              denied: t(locale, "locationDenied"),
            }}
          />
          {rows.length > 0 ? (
            <BusinessList
              locale={locale}
              rows={rows}
              more={
                page.nextCursor
                  ? { place: COUNTRY_SLUG, kind: kind.slug, cursor: page.nextCursor }
                  : null
              }
            />
          ) : (
            <NoneYet
              title={t(locale, "noneHereYet", { place: t(locale, "country") })}
              subtitle=""
              places={[]}
            />
          )}
        </div>
      </main>
    </>
  );
});
