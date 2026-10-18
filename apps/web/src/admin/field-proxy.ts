import "server-only";
import { adminToken } from "./auth";

const NO_STORE = { "cache-control": "no-store" };
/** The phone sends a downscaled JPEG (well under 1 MB); the API refuses anything past 8 MB. */
export const FIELD_MAX_BYTES = 8 * 1024 * 1024;
export const FIELD_ACTIONS = ["photo", "read", "duplicates", "captures"] as const;
export type FieldAction = (typeof FIELD_ACTIONS)[number];

const answer = (status: number, body: object) => Response.json(body, { status, headers: NO_STORE });

/**
 * Same-origin requests only: the admin's cookie must never carry a write another site started.
 * Browsers always send Origin on a POST from fetch.
 */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/**
 * The phone's calls for Add from the street, forwarded to the API with the admin's own token (the
 * API's AdminGuard decides). Images go on as raw bytes; everything else as JSON.
 */
export async function forwardField(
  action: string,
  request: Request,
  fetchImpl: typeof fetch = fetch,
  token: () => Promise<string | null> = adminToken,
): Promise<Response> {
  if (!(FIELD_ACTIONS as readonly string[]).includes(action)) return answer(404, {});
  const method = request.method;
  if (method !== "POST" && !(method === "GET" && action === "captures")) return answer(405, {});
  if (method === "POST" && !sameOrigin(request)) return answer(403, { reason: "origin" });
  const bearer = await token();
  if (!bearer) return answer(401, { reason: "signed-out" });
  const base = (process.env.API_URL ?? "").replace(/\/+$/, "");
  const headers: Record<string, string> = { authorization: `Bearer ${bearer}` };
  let body: BodyInit | undefined;
  if (action === "photo" || action === "read") {
    if (Number(request.headers.get("content-length") ?? 0) > FIELD_MAX_BYTES + 64 * 1024)
      return answer(413, { reason: "too-large" });
    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof Blob)) return answer(400, { reason: "not-image" });
    if (file.size > FIELD_MAX_BYTES) return answer(413, { reason: "too-large" });
    headers["content-type"] = "application/octet-stream";
    body = await file.arrayBuffer();
  } else if (method === "POST") {
    headers["content-type"] = "application/json";
    body = await request.text();
  }
  try {
    const res = await fetchImpl(`${base}/admin/field/${action}`, {
      method,
      headers,
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(action === "read" ? 45_000 : 20_000),
    });
    const json = await res.json().catch(() => ({}));
    return answer(res.status, json as object);
  } catch {
    return answer(503, { reason: "unavailable" });
  }
}
