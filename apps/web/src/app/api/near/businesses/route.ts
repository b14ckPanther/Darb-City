import { pickText } from "@darb/core";
import { z } from "zod";
import {
  ApiBadRequestError,
  ApiUnavailableError,
  getBusinesses,
  getNearestPlace,
  getPlaces,
  getTaxonomy,
} from "@/lib/api";
import { roundPoint } from "@/lib/client-ip";
import { formatKm } from "@/lib/format";
import { COUNTRY_SLUG } from "@/lib/levels";
import { placeNames, toRows } from "@/lib/rows";
import { indexTaxonomy } from "@/lib/taxonomy";

const coordinate = (min: number, max: number) => z.number().min(min).max(max);
const Body = z.object({
  locale: z.enum(["he", "ar", "en"]),
  lat: coordinate(-90, 90),
  lng: coordinate(-180, 180),
  cursor: z.string().min(1).max(512).optional(),
});

/**
 * The /near page's list: every business in the country, closest to the visitor first. The point
 * arrives in the body (never a URL or a log), is rounded, used once and never cached.
 */
export async function POST(request: Request): Promise<Response> {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ message: "Bad body" }, { status: 400 });
  const { locale, cursor } = parsed.data;
  const near = roundPoint(parsed.data);
  try {
    const [page, taxonomy, places, place] = await Promise.all([
      getBusinesses(COUNTRY_SLUG, { near, cursor }),
      getTaxonomy(),
      getPlaces("live"),
      // The first page names where the visitor is; later pages only add rows.
      cursor ? null : getNearestPlace(near.lat, near.lng, "no-store"),
    ]);
    if (!page) return Response.json({ message: "Not found" }, { status: 404 });
    const rows = toRows(page.items, {
      locale,
      index: indexTaxonomy(taxonomy),
      names: placeNames(null, places),
      here: null,
      kmLabel: (km) => formatKm(km, locale),
    });
    return Response.json(
      {
        rows,
        nextCursor: page.nextCursor,
        ...(place ? { place: pickText(place.name, locale) } : {}),
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof ApiBadRequestError)
      return Response.json({ message: "Bad cursor" }, { status: 400 });
    if (error instanceof ApiUnavailableError)
      return Response.json({ message: "Unavailable" }, { status: 503 });
    throw error;
  }
}
