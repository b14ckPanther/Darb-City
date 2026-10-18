import { SlugSchema } from "@darb/contracts";
import { z } from "zod";
import { ApiUnavailableError, getBusinesses, getPlace, getTaxonomy } from "@/lib/api";
import { pinsFromRows, PREVIEW_CAP, type MapPin } from "@/lib/map-pins";
import { placeNames, toRows } from "@/lib/rows";
import { indexTaxonomy } from "@/lib/taxonomy";

const Query = z.object({
  locale: z.enum(["he", "ar", "en"]),
  place: SlugSchema,
  kind: SlugSchema,
});

/** The API's largest page. */
const PAGE = 100;

/**
 * One category's businesses in a place, as map pins: what the map previews while someone looks
 * at a category row. At most PREVIEW_CAP pins, each opening the same sheet as its list row. The
 * lists behind it are cached for a day (lib/api.ts), so a hover costs no API call after the first.
 */
export async function GET(request: Request): Promise<Response> {
  const parsed = Query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return Response.json({ message: "Bad query" }, { status: 400 });
  const { locale, place, kind } = parsed.data;
  try {
    const [taxonomy, detail] = await Promise.all([getTaxonomy(), getPlace(place)]);
    if (!detail) return Response.json({ message: "Not found" }, { status: 404 });
    const ctx = { locale, index: indexTaxonomy(taxonomy), names: placeNames(detail), here: place };
    const pins: MapPin[] = [];
    let cursor: string | undefined;
    let more = false;
    do {
      const page = await getBusinesses(place, { kind, limit: PAGE, cursor });
      if (!page) return Response.json({ message: "Not found" }, { status: 404 });
      pins.push(...pinsFromRows(toRows(page.items, ctx)));
      cursor = page.nextCursor ?? undefined;
      more = cursor !== undefined;
    } while (more && pins.length < PREVIEW_CAP);
    return Response.json(
      { pins: pins.slice(0, PREVIEW_CAP), more: more || pins.length > PREVIEW_CAP },
      { headers: { "Cache-Control": "public, max-age=300" } },
    );
  } catch (error) {
    if (error instanceof ApiUnavailableError)
      return Response.json({ message: "Unavailable" }, { status: 503 });
    throw error;
  }
}
