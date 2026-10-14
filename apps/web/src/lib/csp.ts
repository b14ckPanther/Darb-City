type Directives = Record<string, string[]>;

const serialize = (d: Directives) =>
  Object.entries(d)
    .map(([k, v]) => (v.length ? `${k} ${v.join(" ")}` : k))
    .join("; ");

const base = (dev: boolean): Directives => ({
  "default-src": ["'self'"],
  "style-src": ["'self'", "'unsafe-inline'"],
  "img-src": ["'self'", "data:"],
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
  });
}

/** /admin renders per request, so it gets a real nonce (Clerk's script loads under strict-dynamic). */
export function adminCsp({
  nonce,
  clerkOrigin,
  dev,
}: {
  nonce: string;
  clerkOrigin: string | null;
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
    "connect-src": ["'self'", ...clerk, ...(dev ? ["ws:"] : [])],
    "img-src": ["'self'", "data:", "https://img.clerk.com"],
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
