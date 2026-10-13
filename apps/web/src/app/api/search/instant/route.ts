import { ApiUnavailableError, getInstantIndex } from "@/lib/api";

const EDGE = { "cache-control": "public, s-maxage=300, stale-while-revalidate=86400" };

/** Spec §5.2 lane 1, at runtime: places and kinds added in /admin appear without a web build. */
export async function GET(request: Request): Promise<Response> {
  try {
    return Response.json(await getInstantIndex(), { headers: EDGE });
  } catch (error) {
    const fallback = process.env.NEXT_PUBLIC_SEARCH_INDEX_URL;
    if (error instanceof ApiUnavailableError && fallback)
      return Response.redirect(new URL(fallback, request.url), 307);
    throw error;
  }
}
