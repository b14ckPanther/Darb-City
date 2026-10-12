import { pickText } from "@darb/core";
import type { CityDot } from "@darb/stage";
import { z } from "zod";
import { ApiUnavailableError, getDensity, getPlaces } from "@/lib/api";
import { href, paths } from "@/lib/routes";

const Query = z.object({ locale: z.enum(["he", "ar", "en"]) });

/** Map dots are settlements, as in DensitySchema: never the country, regions or neighbourhoods. */
const SETTLEMENTS: ReadonlySet<string> = new Set(["city", "town", "village"]);

/** The level 0 map's live places, named in the page language, with their business counts. */
export async function GET(request: Request): Promise<Response> {
  const parsed = Query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return Response.json({ message: "Bad query" }, { status: 400 });
  const { locale } = parsed.data;
  try {
    const [places, density] = await Promise.all([getPlaces("live"), getDensity()]);
    const dots: CityDot[] = places
      .filter((p) => SETTLEMENTS.has(p.type))
      .map((p) => ({
        slug: p.slug,
        name: pickText(p.name, locale),
        lat: p.lat,
        lng: p.lng,
        count: density[p.slug] ?? 0,
        href: href(locale, paths.place(p.slug)),
      }));
    return Response.json({ dots }, { headers: { "Cache-Control": "public, max-age=300" } });
  } catch (error) {
    if (error instanceof ApiUnavailableError)
      return Response.json({ message: "Unavailable" }, { status: 503 });
    throw error;
  }
}
