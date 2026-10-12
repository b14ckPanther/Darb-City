import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { pickText } from "@darb/core";
import { t } from "@darb/i18n";
import { CityBar } from "@/components/CityBar";
import { ExperienceView } from "@/components/ExperienceView";
import { Sheet } from "@/components/Sheet";
import { getBusiness } from "@/lib/api";
import { crumbsFor } from "@/lib/crumbs";
import { loadKindLevel } from "@/lib/levels";
import { pageMetadata } from "@/lib/metadata";
import { href, paths } from "@/lib/routes";
import { siteUrl } from "@/lib/site";
import { kindCovers } from "@/lib/taxonomy";

export const revalidate = 300;
export function generateStaticParams() {
  return [];
}

type Params = { locale: string; place: string; sector: string; kind: string; business: string };
type Props = { params: Promise<Params> };

/** The business must live in exactly this place (the API 404s otherwise) and be of this kind. */
async function load(params: Props["params"]) {
  const raw = await params;
  const level = await loadKindLevel(raw, [raw.business]);
  const business = await getBusiness(level.place.slug, raw.business);
  if (!business) notFound();
  const ofKind = [business.primaryKindId, ...business.kindIds].some((id) =>
    kindCovers(level.index, level.kind.id, id),
  );
  if (!ofKind) notFound();
  const primaryKind = level.index.kindById.get(business.primaryKindId) ?? level.kind;
  return { ...level, business, primaryKind };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, place, sector, kind, business } = await load(params);
  return pageMetadata({
    locale,
    segments: paths.business(place.slug, sector.slug, kind.slug, business.slug),
    title: pickText(business.name, locale),
    description:
      pickText(business.tagline, locale) ||
      t(locale, "kindInPlace", {
        kind: pickText(kind.name, locale),
        place: pickText(place.name, locale),
      }),
  });
}

export default async function BusinessPage({ params }: Props) {
  const { locale, place, sector, kind, business, primaryKind } = await load(params);
  const segments = paths.business(place.slug, sector.slug, kind.slug, business.slug);
  return (
    <>
      <CityBar
        locale={locale}
        crumbs={crumbsFor(locale, { place, sector, kind, business })}
        segments={segments}
      />
      <Sheet
        closeHref={href(locale, paths.kind(place.slug, sector.slug, kind.slug))}
        labelledBy="sheet-title"
        returnFocusTo={`${place.slug}/${business.slug}`}
        labels={{ close: t(locale, "close"), resize: t(locale, "resizeSheet") }}
      >
        <ExperienceView
          locale={locale}
          business={business}
          kind={primaryKind}
          placeName={pickText(place.name, locale)}
          segments={segments}
          shareUrl={`${siteUrl()}${href(locale, segments)}`}
        />
      </Sheet>
    </>
  );
}
