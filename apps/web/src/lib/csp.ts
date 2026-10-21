type Directives = Record<string, string[]>;

/** The media bucket's public domain (R2, darb-media): business photos and logos. */
export const MEDIA_ORIGIN = "https://media.darb.co.il";

const serialize = (d: Directives) =>
  Object.entries(d)
    .map(([k, v]) => (v.length ? `${k} ${v.join(" ")}` : k))
    .join("; ");

const base = (dev: boolean): Directives => ({
  "default-src": ["'self'"],
  "style-src": ["'self'", "'unsafe-inline'"],
  "img-src": ["'self'", "data:", MEDIA_ORIGIN],
  "font-src": ["'self'"],
  "worker-src": ["'self'"],
  "manifest-src": ["'self'"],
  "object-src": ["'none'"],
  "base-uri": ["'self'"],
  "form-action": ["'self'"],
  "frame-ancestors": ["'none'"],
  ...(dev ? {} : { "upgrade-insecure-requests": [] }),
});

/**
 * ISR pages cannot carry a per-request nonce (Next applies nonces only to dynamic renders), so
 * scripts are 'self' plus 'unsafe-inline' for Next's flight scripts and the stage boot script; a
 * hash would switch 'unsafe-inline' off and block them. Everything else is locked down.
 */
export function publicCsp({
  tilesOrigin,
  dev,
}: {
  tilesOrigin: string | null;
  dev: boolean;
}): string {
  return serialize({
    ...base(dev),
    "script-src": ["'self'", "'unsafe-inline'", ...(dev ? ["'unsafe-eval'"] : [])],
    "connect-src": ["'self'", ...(tilesOrigin ? [tilesOrigin] : []), ...(dev ? ["ws:"] : [])],
    // The showroom runs Darb's client builds live, and they all live on darb.co.il subdomains.
    "frame-src": ["https://*.darb.co.il"],
  });
}

/**
 * /admin renders per request, so it gets a real nonce (Clerk's script loads under strict-dynamic).
 * The business location picker reads the same tiles as the city, from R2 in production.
 */
const CLERK_PROTECT = "https://*.client.protect.clerk.com:*";

export function adminCsp({
  nonce,
  clerkOrigin,
  tilesOrigin,
  dev,
}: {
  nonce: string;
  clerkOrigin: string | null;
  tilesOrigin: string | null;
  dev: boolean;
}): string {
  const clerk = clerkOrigin ? [clerkOrigin] : [];
  return serialize({
    ...base(dev),
    "script-src": [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      ...clerk,
      "https://challenges.cloudflare.com",
      ...(dev ? ["'unsafe-eval'"] : []),
    ],
    // Clerk's bot protection probes its own hosts on several ports during sign-up; blocked, the
    // sign-up waits on a "protect_check" forever and every new account fails.
    "connect-src": [
      "'self'",
      ...clerk,
      ...(clerkOrigin ? [CLERK_PROTECT] : []),
      ...(tilesOrigin ? [tilesOrigin] : []),
      ...(dev ? ["ws:"] : []),
    ],
    // blob: the street capture's preview of the photo just taken (a local object URL).
    "img-src": ["'self'", "data:", "blob:", "https://img.clerk.com", MEDIA_ORIGIN],
    "frame-src": ["https://challenges.cloudflare.com"],
    "worker-src": ["'self'", "blob:"],
  });
}

export function securityHeaders(): Record<string, string> {
  return {
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
    "permissions-policy": "geolocation=(self), camera=(), microphone=(), payment=()",
  };
}
