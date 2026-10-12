import { SlugSchema } from "@darb/contracts";
import { z } from "zod";
import {
  ApiUnavailableError,
  getNearestPlace,
  getNearestPlacesWithKind,
  getTaxonomy,
} from "@/lib/api";
import { href, paths } from "@/lib/routes";
import { indexTaxonomy } from "@/lib/taxonomy";

const coordinate = (min: number, max: number) =>
  z.string().trim().min(1).pipe(z.coerce.number().min(min).max(max));
const Query = z.object({
  locale: z.enum(["he", "ar", "en"]),
  lat: coordinate(-90, 90),
  lng: coordinate(-180, 180),
  kind: SlugSchema.optional(),
});

/** A person's position is used once, never cached and never logged. */
export async function GET(request: Request): Promise<Response> {
  const parsed = Query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return Response.json({ message: "Bad query" }, { status: 400 });
  const { locale, lat, lng, kind } = parsed.data;
  try {
    if (kind) {
      const index = indexTaxonomy(await getTaxonomy());
      const k = index.kindBySlug.get(kind);
      const sector = k ? index.sectorById.get(k.sectorId) : undefined;
      if (!k || !sector) return Response.json({ message: "Unknown kind" }, { status: 404 });
      const [place] = (await getNearestPlacesWithKind(k.slug, lat, lng, 1, "no-store")) ?? [];
      if (!place) return Response.json({ message: "None yet" }, { status: 404 });
      return Response.json({ href: href(locale, paths.kind(place.slug, sector.slug, k.slug)) });
    }
    const place = await getNearestPlace(lat, lng, "no-store");
    if (!place) return Response.json({ message: "No live place" }, { status: 404 });
    return Response.json({ href: href(locale, paths.place(place.slug)) });
  } catch (error) {
    if (error instanceof ApiUnavailableError)
      return Response.json({ message: "Unavailable" }, { status: 503 });
    throw error;
  }
}
