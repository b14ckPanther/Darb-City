import { pickText, type Locale } from "@darb/core";
import { getPlaces, getTaxonomy } from "@/lib/api";
import { closestPath } from "@/lib/fuzzy";
import { isLocale } from "@/lib/locale";
import { href } from "@/lib/routes";
import { indexTaxonomy } from "@/lib/taxonomy";

export async function GET(request: Request): Promise<Response> {
  const path = new URL(request.url).searchParams.get("path") ?? "";
  if (path.length > 300) return Response.json(null, { status: 400 });
  const parts = path
    .split("/")
    .filter(Boolean)
    .map((s) => s.toLowerCase());
  const locale: Locale = parts[0] && isLocale(parts[0]) ? (parts.shift() as Locale) : "he";
  try {
    const [places, taxonomy] = await Promise.all([getPlaces(), getTaxonomy()]);
    const index = indexTaxonomy(taxonomy);
    const kinds = new Map(
      [...index.kindBySlug.values()].map((k) => [
        k.slug,
        index.sectorById.get(k.sectorId)?.slug ?? "",
      ]),
    );
    const match = closestPath(parts, {
      places: places.map((p) => p.slug),
      sectors: index.sectors.map((s) => s.slug),
      kinds,
    });
    if (!match) return Response.json(null, { status: 404 });
    const names = match.flatMap((segment) => {
      if (segment === "k") return [];
      const place = places.find((p) => p.slug === segment);
      const sector = index.sectorBySlug.get(segment);
      const kind = index.kindBySlug.get(segment);
      const name = place?.name ?? kind?.name ?? sector?.name;
      return name ? [pickText(name, locale)] : [];
    });
    return Response.json({ href: href(locale, match), label: names.join(" › ") });
  } catch {
    return Response.json(null, { status: 503 });
  }
}
