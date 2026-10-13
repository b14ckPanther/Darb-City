import { ClickRequestSchema } from "@darb/contracts";
import { postClick } from "@/lib/api";
import { clientIpFrom } from "@/lib/client-ip";

/** Which result a search led to (spec §4.7); sent with navigator.sendBeacon. Never fails the page. */
export async function POST(request: Request): Promise<Response> {
  const parsed = ClickRequestSchema.safeParse(await request.json().catch(() => null));
  if (parsed.success)
    await postClick(parsed.data.queryId, parsed.data.key, clientIpFrom(request.headers)).catch(
      () => undefined,
    );
  return new Response(null, { status: 204 });
}
