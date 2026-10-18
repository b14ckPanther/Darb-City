import {
  facebookUrl,
  googleMapsUrl,
  inIsrael,
  instagramUrl,
  tiktokUrl,
  websiteUrl,
  type BusinessLinks,
  type LatLng,
} from "@darb/core";

/** What a pasted link says on its own, before anything is looked up. */
export interface LinkFacts {
  source: "google" | "waze" | "social" | "website";
  point?: LatLng;
  /** A place name written in the link (Google's /place/<name>, a ?q= that is not a point). */
  name?: string;
  links?: BusinessLinks;
  website?: string;
  /** maps.app.goo.gl and goo.gl/maps: resolved first (resolveShortLink), then read again. */
  short?: boolean;
}

const parse = (raw: string): URL | null => {
  const v = raw.trim();
  try {
    return new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
  } catch {
    return null;
  }
};

const NUM = String.raw`(-?\d{1,3}(?:\.\d+)?)`;
const PAIR = new RegExp(String.raw`^\s*${NUM}\s*,\s*${NUM}\s*$`);

/** "32.86,35.30" (or with a space) to a point in Israel; anything else is undefined. */
export function pair(text: string | null | undefined): LatLng | undefined {
  const m = text ? PAIR.exec(text) : null;
  if (!m) return undefined;
  const p = { lat: Number(m[1]), lng: Number(m[2]) };
  return inIsrael(p) ? p : undefined;
}

const isGoogleHost = (host: string) =>
  /^(?:www\.|maps\.)?google\.(?:com|co\.il|[a-z]{2,3}|com\.[a-z]{2}|co\.[a-z]{2})$/.test(host);
const isShortGoogle = (u: URL) =>
  u.hostname === "maps.app.goo.gl" || (u.hostname === "goo.gl" && u.pathname.startsWith("/maps"));

/** The hosts a short link may redirect to; anything else stops the walk. */
export const isGoogleMapsHost = (host: string) =>
  isGoogleHost(host) || host === "maps.app.goo.gl" || host === "goo.gl";

const decode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};
const words = (s: string) => s.replace(/\+/g, " ").replace(/\s+/g, " ").trim();

function readGoogle(u: URL): LinkFacts {
  const path = decode(u.pathname);
  const href = decode(u.href);
  // !3d!4d is the place's own pin; @lat,lng is only where the map was looking.
  const pin = /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/.exec(href);
  const at = /@(-?\d+\.\d+),(-?\d+\.\d+)/.exec(path);
  const query = ["q", "query", "ll", "daddr", "destination", "center"]
    .map((k) => u.searchParams.get(k))
    .find((v) => v !== null);
  const point =
    (pin ? pair(`${pin[1]},${pin[2]}`) : undefined) ??
    pair(query) ??
    (at ? pair(`${at[1]},${at[2]}`) : undefined);
  const placed = /\/maps\/place\/([^/@]+)/.exec(path)?.[1];
  const name = placed ? words(placed) : query && !pair(query) ? words(query) : undefined;
  return { source: "google", ...(point ? { point } : {}), ...(name ? { name } : {}) };
}

function readWaze(u: URL): LinkFacts {
  const ll = u.searchParams.get("ll") ?? u.searchParams.get("latlng");
  const to = u.searchParams.get("to") ?? u.searchParams.get("from");
  const point = pair(ll) ?? (to?.startsWith("ll.") ? pair(to.slice(3)) : undefined);
  const q = u.searchParams.get("q");
  return { source: "waze", ...(point ? { point } : {}), ...(q ? { name: words(q) } : {}) };
}

/**
 * Reads a pasted link without any API key: Google Maps (long links; short ones are marked for
 * resolveShortLink), Waze, Instagram, Facebook and TikTok, or else a website. Null when it is no
 * link at all.
 */
export function readLink(raw: string): LinkFacts | null {
  const u = parse(raw);
  if (!u || !u.hostname.includes(".")) return null;
  const host = u.hostname.toLowerCase();
  if (isShortGoogle(u)) return { source: "google", short: true };
  if (isGoogleHost(host) && (u.pathname.startsWith("/maps") || host.startsWith("maps.")))
    return readGoogle(u);
  if (host === "waze.com" || host.endsWith(".waze.com")) return readWaze(u);
  const social: [keyof BusinessLinks, string | null][] = [
    ["instagram", instagramUrl(u.href)],
    ["facebook", facebookUrl(u.href)],
    ["tiktok", tiktokUrl(u.href)],
  ];
  const found = social.find(([, v]) => v !== null);
  if (found) return { source: "social", links: { [found[0]]: found[1]! } };
  const website = websiteUrl(u.href);
  return website ? { source: "website", website } : null;
}

/**
 * Follows a short Google Maps link to the long one by reading Location headers (no body is ever
 * read): at most three hops, only between Google Maps hosts, five seconds in all. Null when it
 * does not end on a Google Maps page.
 */
export async function resolveShortLink(
  raw: string,
  fetchImpl: typeof fetch,
): Promise<string | null> {
  let current = parse(raw);
  const signal = AbortSignal.timeout(5000);
  for (let hop = 0; current && hop < 3; hop++) {
    if (!isGoogleMapsHost(current.hostname)) return null;
    if (!isShortGoogle(current)) return current.href;
    let res: Response;
    try {
      res = await fetchImpl(current.href, { method: "GET", redirect: "manual", signal });
    } catch {
      return null;
    }
    await res.body?.cancel().catch(() => undefined);
    const location = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
    if (!location) return null;
    try {
      current = new URL(location, current);
    } catch {
      return null;
    }
    if (current.protocol !== "https:") return null;
  }
  return current && isGoogleMapsHost(current.hostname) && !isShortGoogle(current)
    ? current.href
    : null;
}

/**
 * A Google Maps link as the business keeps it: a short link resolved to the long google.com/maps
 * one when that works, else the short link as given. Null when it is no Google Maps link.
 */
export async function keptGoogleLink(raw: string, fetchImpl: typeof fetch): Promise<string | null> {
  const given = googleMapsUrl(raw);
  if (!given) return null;
  if (!readLink(given)?.short) return given;
  const long = await resolveShortLink(given, fetchImpl).catch(() => null);
  return (long && googleMapsUrl(long)) || given;
}
