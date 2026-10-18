import type { MetadataRoute } from "next";
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
import { BUSINESSES_PER_SITEMAP, readSitemapId, sitemapIds } from "@/lib/sitemap-ids";

/**
 * Rendered per request: a build-time prerender would need the API (the build never calls it, and an
 * unreachable API must not fail the build or cache an empty sitemap). The API reads inside are
 * cached for a day and refreshed by tag, so a crawl costs no API round trip.
 */
export const dynamic = "force-dynamic";

export async function generateSitemaps() {
  return sitemapIds((await getSitemapBusinesses()).length).map((id) => ({ id }));
}

/** At most `size` calls at a time: a sitemap for every place must not fan out hundreds at once. */
async function inBatches<T, R>(items: T[], size: number, run: (item: T) => Promise<R>) {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size)
    out.push(...(await Promise.all(items.slice(i, i + size).map(run))));
  return out;
}

/**
 * Per locale: one sitemap of pages (the legal pages, places, place × sector, nationwide kinds) and
 * slices of real businesses (lib/sitemap-ids). Places, sectors and kinds without a published
 * business are left out.
 */
export default async function sitemap(props: {
  id: Promise<string>;
}): Promise<MetadataRoute.Sitemap> {
  const { locale, slice } = readSitemapId(Number(await props.id));
  const site = siteUrl();
  const taxonomy = await getTaxonomy();
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
  if (slice > 0) {
    const businesses = (await getSitemapBusinesses()).slice(
      (slice - 1) * BUSINESSES_PER_SITEMAP,
      slice * BUSINESSES_PER_SITEMAP,
    );
    return businesses.flatMap((b) => {
      const k = kinds.get(b.primaryKindId);
      return k ? [entry(paths.business(b.placeSlug, k.sector, k.kind, b.slug), b.updatedAt)] : [];
    });
  }
  const [livePlaces, counts, nationalCounts] = await Promise.all([
    getPlaces("live"),
    getPlaceCounts(),
    getKindCounts(COUNTRY_SLUG),
  ]);
  const places = withBusinesses(livePlaces, counts);
  const index = indexTaxonomy(taxonomy);
  const sectorsByPlace = new Map(
    await inBatches(places, 8, async (p) => {
      const totals = sectorTotals(index, (await getKindCounts(p.slug)) ?? {});
      return [p.slug, taxonomy.sectors.filter((s) => (totals.get(s.slug) ?? 0) > 0)] as const;
    }),
  );
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
  ];
}
