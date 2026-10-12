import { revalidateTag } from "next/cache";
import { z } from "zod";

const Body = z.object({ tags: z.array(z.string().min(1).max(256)).min(1).max(64) });

/** The API calls this after a write (spec §6.2) so cached pages refresh without waiting. */
export async function POST(request: Request): Promise<Response> {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret || request.headers.get("x-revalidate-secret") !== secret) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json({ message: "Expected { tags: string[] }" }, { status: 400 });
  for (const tag of parsed.data.tags) revalidateTag(tag, "max");
  return Response.json({ revalidated: parsed.data.tags });
}
