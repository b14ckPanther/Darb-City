import { createHash, timingSafeEqual } from "node:crypto";

/** The part of Express's request this needs (no @types/express in the API's dependencies). */
export interface ClientRequest {
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
}

const header = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

const digest = (v: string) => createHash("sha256").update(v).digest();

/** Constant time over equal-length SHA-256 digests, so neither the key nor its length leaks. */
function sameKey(a: string, b: string): boolean {
  return timingSafeEqual(digest(a), digest(b));
}

/**
 * Decision 5: the web server forwards the visitor's IP with a shared key. Without the key (or
 * with no key configured) the forwarded header is ignored and Express's req.ip (TRUST_PROXY hops)
 * is used, so the rate limit cannot be dodged by sending a header.
 */
export function clientIp(req: ClientRequest, proxyKey: string | null): string {
  const forwarded = header(req.headers["x-darb-client-ip"]).trim();
  const key = header(req.headers["x-darb-proxy-key"]);
  if (proxyKey && forwarded && key && sameKey(key, proxyKey)) return forwarded.slice(0, 64);
  return req.ip ?? "unknown";
}
