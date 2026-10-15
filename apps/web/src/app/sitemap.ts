import type { MetadataRoute } from "next";
import { LOCALES } from "@darb/core";
import {
  getKindCounts,
  getPlaceCounts,
  getPlaces,
  getSitemapBusinesses,
  getTaxonomy,
} from "@/lib/api";
import { href, languageAlternates, paths } from "@/lib/routes";
import { siteUrl } from "@/lib/site";
import { sectorTotals, indexTaxonomy } from "@/lib/taxonomy";
import { COUNTRY_SLUG } from "@/lib/levels";
import { withBusinesses } from "@/lib/visible";

/**
 * Rendered per request: a build-time prerender would need the API (the build never calls it, and an
 * unreachable API must not fail the build or cache an empty sitemap). The API reads inside are
 * cached for a day and refreshed by tag, so a crawl costs no API round trip.
 */
export const dynamic = "force-dynamic";

export async function generateSitemaps() {
  return LOCALES.map((_, id) => ({ id }));
}

/**
 * One sitemap per locale: the legal pages, places, place × sector, nationwide kinds, and real
 * businesses. Places, sectors and kinds without a published business are left out.
 */
export default async function sitemap(props: {
  id: Promise<string>;
}): Promise<MetadataRoute.Sitemap> {
  const locale = LOCALES[Number(await props.id)] ?? "he";
  const site = siteUrl();
  const [livePlaces, counts, taxonomy, businesses, nationalCounts] = await Promise.all([
    getPlaces("live"),
    getPlaceCounts(),
    getTaxonomy(),
    getSitemapBusinesses(),
    getKindCounts(COUNTRY_SLUG),
  ]);
  const places = withBusinesses(livePlaces, counts);
  const index = indexTaxonomy(taxonomy);
  const sectorsByPlace = new Map(
    await Promise.all(
      places.map(async (p) => {
        const totals = sectorTotals(index, (await getKindCounts(p.slug)) ?? {});
        return [p.slug, taxonomy.sectors.filter((s) => (totals.get(s.slug) ?? 0) > 0)] as const;
      }),
    ),
  );
  const kinds = new Map(
    taxonomy.sectors.flatMap((s) => s.kinds.map((k) => [k.id, { kind: k.slug, sector: s.slug }])),
  );
  // The Hebrew home is the bare origin ("https://darb.co.il/"); every other URL has no trailing slash.
  const absolute = (path: string) => (path === "/" ? `${site}/` : `${site}${path}`);
  const entry = (segments: string[], lastModified?: string): MetadataRoute.Sitemap[number] => ({
    url: absolute(href(locale, segments)),
    ...(lastModified ? { lastModified } : {}),
    alternates: {
      languages: Object.fromEntries(
        Object.entries(languageAlternates(segments)).map(([l, u]) => [l, absolute(u)]),
      ),
    },
  });
  return [
    entry(paths.home()),
    entry(paths.accessibility()),
    entry(paths.terms()),
    entry(paths.privacy()),
    ...places.map((p) => entry(paths.place(p.slug))),
    ...places.flatMap((p) =>
      (sectorsByPlace.get(p.slug) ?? []).map((s) => entry(paths.sector(p.slug, s.slug))),
    ),
    ...[...kinds.values()]
      .filter((k) => (nationalCounts?.[k.kind] ?? 0) > 0)
      .map((k) => entry(paths.nationalKind(k.kind))),
    ...businesses.flatMap((b) => {
      const k = kinds.get(b.primaryKindId);
      return k ? [entry(paths.business(b.placeSlug, k.sector, k.kind, b.slug), b.updatedAt)] : [];
    }),
  ];
}
