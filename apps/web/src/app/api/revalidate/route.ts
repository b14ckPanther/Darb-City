import { createHash, timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { z } from "zod";

const Body = z.object({
  tags: z.array(z.string().min(1).max(256)).min(1).max(64),
  /** Takedowns: expire now instead of serving the old page while a new one renders. */
  immediate: z.boolean().optional(),
});
const digest = (s: string) => createHash("sha256").update(s).digest();
/** Equal-length digests: constant time, and the secret's length never leaks. */
const same = (a: string, b: string) => timingSafeEqual(digest(a), digest(b));

/** The API calls this after a write (spec §6.2) so cached pages refresh without waiting. */
export async function POST(request: Request): Promise<Response> {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret || !same(request.headers.get("x-revalidate-secret") ?? "", secret)) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json(
      { message: "Expected { tags: string[], immediate?: boolean }" },
      { status: 400 },
    );
  const profile = parsed.data.immediate ? { expire: 0 } : "max";
  for (const tag of parsed.data.tags) revalidateTag(tag, profile);
  return Response.json({
    revalidated: parsed.data.tags,
    immediate: parsed.data.immediate === true,
  });
}
