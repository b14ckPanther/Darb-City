import { expect, it } from "vitest";
import { adminCsp, publicCsp, securityHeaders } from "./csp";

const directive = (csp: string, name: string) =>
  csp.split("; ").find((d) => d.startsWith(`${name} `)) ?? "";

it("public pages: workers from self, tiles from R2, nothing framed or embedded", () => {
  const csp = publicCsp({ tilesOrigin: "https://tiles.darb.co.il", dev: false });
  expect(directive(csp, "worker-src")).toBe("worker-src 'self'");
  expect(directive(csp, "connect-src")).toBe("connect-src 'self' https://tiles.darb.co.il");
  expect(directive(csp, "frame-ancestors")).toBe("frame-ancestors 'none'");
  expect(directive(csp, "object-src")).toBe("object-src 'none'");
  expect(directive(csp, "script-src")).toBe("script-src 'self' 'unsafe-inline'");
  expect(csp).not.toContain("nonce-");
  // Business photos and logos come from the media bucket; uploads go through /api/join/photos.
  expect(directive(csp, "img-src")).toBe("img-src 'self' data: https://media.darb.co.il");
});

it("development adds eval and the HMR socket only", () => {
  const csp = publicCsp({ tilesOrigin: null, dev: true });
  expect(directive(csp, "script-src")).toContain("'unsafe-eval'");
  expect(directive(csp, "connect-src")).toBe("connect-src 'self' ws:");
  expect(csp).not.toContain("upgrade-insecure-requests");
});

it("admin pages: a nonce with strict-dynamic, and Clerk's origin", () => {
  const csp = adminCsp({
    nonce: "abc",
    clerkOrigin: "https://clerk.darb.co.il",
    tilesOrigin: null,
    dev: false,
  });
  expect(directive(csp, "script-src")).toBe(
    "script-src 'self' 'nonce-abc' 'strict-dynamic' https://clerk.darb.co.il https://challenges.cloudflare.com",
  );
  expect(directive(csp, "connect-src")).toBe("connect-src 'self' https://clerk.darb.co.il");
  expect(directive(csp, "frame-src")).toBe("frame-src https://challenges.cloudflare.com");
  expect(directive(csp, "img-src")).toBe(
    "img-src 'self' data: https://img.clerk.com https://media.darb.co.il",
  );
});

it("admin pages read the map tiles from R2 for the location picker, workers from self and blob:", () => {
  const csp = adminCsp({
    nonce: "abc",
    clerkOrigin: "https://clerk.darb.co.il",
    tilesOrigin: "https://tiles.darb.co.il",
    dev: false,
  });
  expect(directive(csp, "connect-src")).toBe(
    "connect-src 'self' https://clerk.darb.co.il https://tiles.darb.co.il",
  );
  expect(directive(csp, "worker-src")).toBe("worker-src 'self' blob:");
});

it("sends the standard hardening headers, geolocation for this site only", () => {
  expect(securityHeaders()).toEqual({
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
    "permissions-policy": "geolocation=(self), camera=(), microphone=(), payment=()",
  });
});
