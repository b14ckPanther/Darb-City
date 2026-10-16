import { JoinCreateSchema } from "@darb/contracts";
import { ApiUnavailableError, postJoin } from "@/lib/api";
import { clientIpFrom } from "@/lib/client-ip";

const NO_STORE = { "cache-control": "no-store" };

/** Same-origin /join form: forwarded to the API with the visitor's IP, never stored here. */
export async function POST(request: Request): Promise<Response> {
  const parsed = JoinCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json({ message: "Bad form" }, { status: 400, headers: NO_STORE });
  try {
    const res = await postJoin(parsed.data, clientIpFrom(request.headers));
    if (res.status === 429)
      return Response.json(
        { message: "Too many" },
        { status: 429, headers: { ...NO_STORE, "retry-after": String(res.retryAfter) } },
      );
    if (res.status === 400)
      return Response.json({ message: "Bad form" }, { status: 400, headers: NO_STORE });
    return Response.json({ ok: true }, { status: 201, headers: NO_STORE });
  } catch (error) {
    if (error instanceof ApiUnavailableError)
      return Response.json({ message: "Unavailable" }, { status: 503, headers: NO_STORE });
    throw error;
  }
}
