import { JoinLookupRequestSchema } from "@darb/contracts";
import { ApiUnavailableError, postJoinLookup } from "@/lib/api";
import { clientIpFrom } from "@/lib/client-ip";

const NO_STORE = { "cache-control": "no-store" };

/**
 * "Find my business" from the /join form. A point from "I'm at my business now" travels in the
 * body only, and nothing here keeps it.
 */
export async function POST(request: Request): Promise<Response> {
  const parsed = JoinLookupRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json({ message: "Bad lookup" }, { status: 400, headers: NO_STORE });
  try {
    const res = await postJoinLookup(parsed.data, clientIpFrom(request.headers));
    if (res.status === 429)
      return Response.json(
        { message: "Too many" },
        { status: 429, headers: { ...NO_STORE, "retry-after": String(res.retryAfter) } },
      );
    if (res.status === 400)
      return Response.json({ message: "Bad lookup" }, { status: 400, headers: NO_STORE });
    return Response.json(res.body, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof ApiUnavailableError)
      return Response.json({ message: "Unavailable" }, { status: 503, headers: NO_STORE });
    throw error;
  }
}
