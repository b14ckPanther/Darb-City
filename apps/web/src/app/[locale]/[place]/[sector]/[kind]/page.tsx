import type { Metadata } from "next";
import { pickText } from "@darb/core";
import { t } from "@darb/i18n";
import { CityBar } from "@/components/CityBar";
import { crumbsFor } from "@/lib/crumbs";
import { loadKindLevel } from "@/lib/levels";
import { pageMetadata } from "@/lib/metadata";
import { paths } from "@/lib/routes";
import { metadataOrUnavailable, orUnavailable } from "@/lib/unavailable";

export const revalidate = 300;
export function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ locale: string; place: string; sector: string; kind: string }> };

export const generateMetadata = metadataOrUnavailable(async function metadata({
  params,
}: Props): Promise<Metadata> {
  const { locale, place, sector, kind } = await loadKindLevel(await params);
  return pageMetadata({
    locale,
    segments: paths.kind(place.slug, sector.slug, kind.slug),
    title: t(locale, "kindInPlace", {
      kind: pickText(kind.name, locale),
      place: pickText(place.name, locale),
    }),
    description: t(locale, "tagline"),
  });
});

export default orUnavailable(async function KindPage({ params }: Props) {
  const { locale, place, sector, kind } = await loadKindLevel(await params);
  return (
    <CityBar
      locale={locale}
      crumbs={crumbsFor(locale, { place, sector, kind })}
      segments={paths.kind(place.slug, sector.slug, kind.slug)}
    />
  );
});
