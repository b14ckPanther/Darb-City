import { notFound, redirect } from "next/navigation";
import { getTaxonomy } from "@/lib/api";
import { localeOrNotFound } from "@/lib/levels";
import { href, paths } from "@/lib/routes";
import { indexTaxonomy } from "@/lib/taxonomy";

export const revalidate = 300;
export function generateStaticParams() {
  return [];
}

/** Search lands here without knowing the sector; the canonical URL has it. */
export default async function PlaceKindShortcut({
  params,
}: {
  params: Promise<{ locale: string; place: string; kind: string }>;
}) {
  const raw = await params;
  const locale = localeOrNotFound(raw.locale);
  const index = indexTaxonomy(await getTaxonomy());
  const kind = index.kindBySlug.get(raw.kind);
  const sector = kind ? index.sectorById.get(kind.sectorId) : undefined;
  if (!kind || !sector) notFound();
  redirect(href(locale, paths.kind(raw.place, sector.slug, kind.slug)));
}
