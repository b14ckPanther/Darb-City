import { SlugSchema } from "@darb/contracts";
import { z } from "zod";
import { ApiUnavailableError, getSuggestions } from "@/lib/api";
import { suggestionOptions } from "@/search/options";

const Query = z.object({
  q: z.string().trim().max(60),
  locale: z.enum(["he", "ar", "en"]),
  place: SlugSchema.optional(),
});
const EDGE = { "cache-control": "public, s-maxage=300, stale-while-revalidate=600" };

/** Spec §5.2: business names for the combobox, cached at the edge. */
export async function GET(request: Request): Promise<Response> {
  const parsed = Query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return Response.json({ message: "Bad query" }, { status: 400 });
  const { q, locale, place } = parsed.data;
  if (q.length < 2) return Response.json({ options: [] }, { headers: EDGE });
  try {
    return Response.json(
      { options: suggestionOptions(await getSuggestions(q, place), locale) },
      { headers: EDGE },
    );
  } catch (error) {
    if (error instanceof ApiUnavailableError)
      return Response.json({ options: [] }, { status: 503 });
    throw error;
  }
}
