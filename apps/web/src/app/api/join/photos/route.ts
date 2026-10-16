import { ApiUnavailableError, postJoinPhoto } from "@/lib/api";
import { clientIpFrom } from "@/lib/client-ip";

const NO_STORE = { "cache-control": "no-store" };
const MAX_BYTES = 8 * 1024 * 1024;

const answer = (status: number, body: object) => Response.json(body, { status, headers: NO_STORE });

/**
 * One photo or logo from the /join form (or the admin's business form), as multipart field
 * "file". Only its bytes go on to the API, which reads the format from them, shrinks the image
 * and stores it; the file's name and declared type are never trusted.
 */
export async function POST(request: Request): Promise<Response> {
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BYTES + 64 * 1024)
    return answer(413, { reason: "too-large" });
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof Blob)) return answer(400, { reason: "not-image" });
  if (file.size > MAX_BYTES) return answer(413, { reason: "too-large" });
  const variant = new URL(request.url).searchParams.get("variant") === "logo" ? "logo" : "photo";
  try {
    const res = await postJoinPhoto(
      await file.arrayBuffer(),
      variant,
      clientIpFrom(request.headers),
    );
    if (res.status === 201) return answer(201, res.body);
    return answer(res.status, res.reason ? { reason: res.reason } : {});
  } catch (error) {
    if (error instanceof ApiUnavailableError) return answer(503, { reason: "unavailable" });
    throw error;
  }
}
