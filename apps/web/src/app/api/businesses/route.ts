import { SlugSchema } from "@darb/contracts";
import { z } from "zod";
import {
  ApiBadRequestError,
  ApiUnavailableError,
  getBusinesses,
  getPlace,
  getPlaces,
  getTaxonomy,
} from "@/lib/api";
import { roundPoint } from "@/lib/client-ip";
import { formatKm } from "@/lib/format";
import { COUNTRY_SLUG } from "@/lib/levels";
import { placeNames, toRows } from "@/lib/rows";
import { indexTaxonomy } from "@/lib/taxonomy";

const Query = z.object({
  locale: z.enum(["he", "ar", "en"]),
  place: SlugSchema,
  kind: SlugSchema,
  cursor: z.string().min(1).max(512),
});

export async function GET(request: Request): Promise<Response> {
  const parsed = Query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return Response.json({ message: "Bad query" }, { status: 400 });
  const { locale, place, kind, cursor } = parsed.data;
  try {
    const [page, taxonomy, detail, places] = await Promise.all([
      getBusinesses(place, { kind, cursor }),
      getTaxonomy(),
      place === COUNTRY_SLUG ? null : getPlace(place),
      place === COUNTRY_SLUG ? getPlaces("live") : [],
    ]);
    if (!page) return Response.json({ message: "Not found" }, { status: 404 });
    const rows = toRows(page.items, {
      locale,
      index: indexTaxonomy(taxonomy),
      names: placeNames(detail, places),
      here: place === COUNTRY_SLUG ? null : place,
    });
    return Response.json({ rows, nextCursor: page.nextCursor });
  } catch (error) {
    if (error instanceof ApiBadRequestError)
      return Response.json({ message: "Bad cursor" }, { status: 400 });
    if (error instanceof ApiUnavailableError)
      return Response.json({ message: "Unavailable" }, { status: 503 });
    throw error;
  }
}
const Body = z.object({
  locale: z.enum(["he", "ar", "en"]),
  place: SlugSchema,
  kind: SlugSchema,
  cursor: z.string().min(1).max(512).optional(),
  open: z.boolean().optional(),
  delivers: z.boolean().optional(),
  glutenFree: z.boolean().optional(),
  near: z
    .object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })
    .optional(),
});

/** Level-3 filters (I4). A Near me point is rounded, used once, never cached or logged. */
export async function POST(request: Request): Promise<Response> {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ message: "Bad query" }, { status: 400 });
  const { locale, place, kind, cursor, open, delivers, glutenFree, near } = parsed.data;
  try {
    const [page, taxonomy, detail] = await Promise.all([
      getBusinesses(place, {
        kind,
        cursor,
        open,
        delivers,
        ...(glutenFree ? { dietary: "gluten_free" as const } : {}),
        ...(near ? { near: roundPoint(near) } : {}),
      }),
      getTaxonomy(),
      getPlace(place),
    ]);
    if (!page) return Response.json({ message: "Not found" }, { status: 404 });
    const rows = toRows(page.items, {
      locale,
      index: indexTaxonomy(taxonomy),
      names: placeNames(detail),
      here: place,
      kmLabel: (km) => formatKm(km, locale),
    });
    return Response.json(
      { rows, nextCursor: page.nextCursor },
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
