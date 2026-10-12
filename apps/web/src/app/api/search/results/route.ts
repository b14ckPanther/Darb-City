import { ResultsRequestSchema } from "@darb/contracts";
import { ApiUnavailableError, postResults } from "@/lib/api";
import { clientIpFrom, roundPoint } from "@/lib/client-ip";

const NO_STORE = { "cache-control": "no-store" };

/** Chip edits: retrieval again with the edited intent, never the model. */
export async function POST(request: Request): Promise<Response> {
  const parsed = ResultsRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json({ message: "Bad query" }, { status: 400, headers: NO_STORE });
  const body = {
    ...parsed.data,
    ...(parsed.data.near ? { near: roundPoint(parsed.data.near) } : {}),
  };
  try {
    const res = await postResults(body, clientIpFrom(request.headers));
    if (res.status === 429)
      return Response.json(
        { message: "Too many" },
        { status: 429, headers: { ...NO_STORE, "retry-after": String(res.retryAfter) } },
      );
    if (res.status === 400)
      return Response.json({ message: "Bad query" }, { status: 400, headers: NO_STORE });
    return Response.json(res.body, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof ApiUnavailableError)
      return Response.json({ message: "Unavailable" }, { status: 503, headers: NO_STORE });
    throw error;
  }
}
