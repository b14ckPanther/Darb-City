import type { CityDot } from "@darb/stage";
import { ApiUnavailableError, getDensity, getPlaces } from "@/lib/api";

/** Map dots are settlements, as in DensitySchema: never the country, regions or neighbourhoods. */
const SETTLEMENTS: ReadonlySet<string> = new Set(["city", "town", "village"]);

/**
 * The country map's faint warmth: each live settlement's point and business count. Never drawn
 * as a number (map-layers.ts HEAT); empty places are left out of the warmth.
 */
export async function GET(): Promise<Response> {
  try {
    const [places, density] = await Promise.all([getPlaces("live"), getDensity()]);
    const dots: CityDot[] = places
      .filter((p) => SETTLEMENTS.has(p.type))
      .map((p) => ({ slug: p.slug, lat: p.lat, lng: p.lng, count: density[p.slug] ?? 0 }));
    return Response.json({ dots }, { headers: { "Cache-Control": "public, max-age=300" } });
  } catch (error) {
    if (error instanceof ApiUnavailableError)
      return Response.json({ message: "Unavailable" }, { status: 503 });
    throw error;
  }
}
