import type { MetadataRoute } from "next";
import { LOCALES } from "@darb/core";
import { getPlaces, getSitemapBusinesses, getTaxonomy } from "@/lib/api";
import { href, languageAlternates, paths } from "@/lib/routes";
import { siteUrl } from "@/lib/site";

export const revalidate = 86400;

export async function generateSitemaps() {
  return LOCALES.map((_, id) => ({ id }));
}

/** One sitemap per locale: places, place × sector, nationwide kinds, and real businesses. */
export default async function sitemap(props: {
  id: Promise<string>;
}): Promise<MetadataRoute.Sitemap> {
  const locale = LOCALES[Number(await props.id)] ?? "he";
  const site = siteUrl();
  const [places, taxonomy, businesses] = await Promise.all([
    getPlaces("live"),
    getTaxonomy(),
    getSitemapBusinesses(),
  ]);
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
    ...places.map((p) => entry(paths.place(p.slug))),
    ...places.flatMap((p) => taxonomy.sectors.map((s) => entry(paths.sector(p.slug, s.slug)))),
    ...[...kinds.values()].map((k) => entry(paths.nationalKind(k.kind))),
    ...businesses.flatMap((b) => {
      const k = kinds.get(b.primaryKindId);
      return k ? [entry(paths.business(b.placeSlug, k.sector, k.kind, b.slug), b.updatedAt)] : [];
    }),
  ];
}
