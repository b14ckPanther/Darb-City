import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { adminAuthMode, clerkOrigin } from "./admin/mode";
import { adminRoute } from "./admin/routes";
import { helperRoute } from "./helpers/routes";
import { adminCsp, publicCsp, securityHeaders } from "./lib/csp";
import { routeLocale } from "./lib/locale-path";
import { indexable } from "./lib/site";
import { tilesOrigin } from "./stage/vendor";

const DEV = process.env.NODE_ENV !== "production";
const PUBLIC_CSP = publicCsp({ tilesOrigin: tilesOrigin(), dev: DEV });

function withHeaders(res: NextResponse, host: string): NextResponse {
  res.headers.set("content-security-policy", PUBLIC_CSP);
  for (const [k, v] of Object.entries(securityHeaders())) res.headers.set(k, v);
  // Previews, staging and local runs stay out of search engines (Task 22).
  if (!indexable(process.env, host)) res.headers.set("x-robots-tag", "noindex, nofollow");
  return res;
}

/** The two signed-in apps: the admin and the helper app, each rewritten to app/<app>/[locale]. */
type App = "admin" | "helpers";
const appOf = (pathname: string): App | null =>
  adminRoute(pathname) ? "admin" : helperRoute(pathname) ? "helpers" : null;

/**
 * /admin and /helpers render per request: a fresh nonce, noindex, no-store, rewritten to
 * app/admin/[locale] or app/helpers/[locale].
 */
function adminResponse(request: NextRequest): NextResponse {
  const app = appOf(request.nextUrl.pathname)!;
  const route = (app === "admin" ? adminRoute : helperRoute)(request.nextUrl.pathname)!;
  const nonce = btoa(crypto.randomUUID());
  const csp = adminCsp({
    nonce,
    clerkOrigin: clerkOrigin(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY),
    tilesOrigin: tilesOrigin(),
    dev: DEV,
  });
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("content-security-policy", csp);
  // The shell needs the public path (/ar/admin/x) to mark the current section and switch language.
  headers.set(`x-darb-${app === "admin" ? "admin" : "helper"}-path`, request.nextUrl.pathname);
  const url = request.nextUrl.clone();
  url.pathname = `/${app}/${route.locale}${route.rest}`;
  const res = NextResponse.rewrite(url, { request: { headers } });
  res.headers.set("content-security-policy", csp);
  res.headers.set("x-robots-tag", "noindex, nofollow");
  res.headers.set("cache-control", "no-store");
  for (const [k, v] of Object.entries(securityHeaders())) res.headers.set(k, v);
  return res;
}
/** The internal shape the rewrite targets (app/<app>/[locale]); reachable only through adminResponse. */
const INTERNAL_ADMIN = /^\/(?:admin|helpers)\/(?:he|ar|en)(?:\/|$)/;
function internalAdminNotFound(): NextResponse {
  const res = new NextResponse("Not found", { status: 404 });
  res.headers.set("x-robots-tag", "noindex, nofollow");
  res.headers.set("cache-control", "no-store");
  for (const [k, v] of Object.entries(securityHeaders())) res.headers.set(k, v);
  return res;
}
const clerkAdmin = clerkMiddleware(async (_auth, request) => adminResponse(request));

export async function proxy(
  request: NextRequest,
  event?: NextFetchEvent,
): Promise<NextResponse | Response> {
  if (INTERNAL_ADMIN.test(request.nextUrl.pathname)) return internalAdminNotFound();
  if (appOf(request.nextUrl.pathname)) {
    // Clerk runs only on admin and helper requests: public pages never load or call Clerk.
    if (adminAuthMode() === "clerk" && event)
      return (await clerkAdmin(request, event)) ?? adminResponse(request);
    return adminResponse(request);
  }
  const route = routeLocale(request.nextUrl.pathname);
  const host = request.nextUrl.host;
  if (route.action === "next") return withHeaders(NextResponse.next(), host);
  const url = request.nextUrl.clone();
  url.pathname = route.pathname;
  return withHeaders(
    route.action === "redirect" ? NextResponse.redirect(url, 308) : NextResponse.rewrite(url),
    host,
  );
}

export const config = {
  // Route handlers, Next internals, brand files and anything with a file extension skip the proxy,
  // except admin and helper paths: a dot in one (/admin/businesses/x.y) must still get the nonce
  // CSP and noindex, and the internal /admin/<locale> and /helpers/<locale> shapes must still 404.
  // /__clerk/ is Clerk's frontend API proxy path, kept for later.
  matcher: [
    "/((?!api/|_next/|brand/|.*\\..*).*)",
    "/admin",
    "/admin/:path*",
    "/(ar|en)/admin",
    "/(ar|en)/admin/:path*",
    "/helpers",
    "/helpers/:path*",
    "/(ar|en)/helpers",
    "/(ar|en)/helpers/:path*",
    "/__clerk/(.*)",
  ],
};
