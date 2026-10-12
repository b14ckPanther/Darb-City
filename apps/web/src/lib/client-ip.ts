/**
 * The visitor's IP as this server sees it: the first X-Forwarded-For hop (Vercel sets it), then
 * X-Real-IP. Used only to rate-limit searches at the API, never stored there (only a salted hash).
 */
export function clientIpFrom(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "local";
}

/** About 110 m: enough to sort by distance, too coarse to point at a home. */
export const roundPoint = (p: { lat: number; lng: number }) => ({
  lat: Math.round(p.lat * 1000) / 1000,
  lng: Math.round(p.lng * 1000) / 1000,
});
