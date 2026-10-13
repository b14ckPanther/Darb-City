import { NextResponse, type NextRequest } from "next/server";
import { publicCsp, securityHeaders } from "./lib/csp";
import { routeLocale } from "./lib/locale-path";
import { indexable } from "./lib/site";
import { tilesOrigin } from "./stage/vendor";

const DEV = process.env.NODE_ENV !== "production";
const PUBLIC_CSP = publicCsp({ tilesOrigin: tilesOrigin(), dev: DEV });

function withHeaders(res: NextResponse): NextResponse {
  res.headers.set("content-security-policy", PUBLIC_CSP);
  for (const [k, v] of Object.entries(securityHeaders())) res.headers.set(k, v);
  // Previews, staging and local runs stay out of search engines (Task 22).
  if (!indexable()) res.headers.set("x-robots-tag", "noindex, nofollow");
  return res;
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const route = routeLocale(request.nextUrl.pathname);
  if (route.action === "next") return withHeaders(NextResponse.next());
  const url = request.nextUrl.clone();
  url.pathname = route.pathname;
  return withHeaders(
    route.action === "redirect" ? NextResponse.redirect(url, 308) : NextResponse.rewrite(url),
  );
}

export const config = {
  // Route handlers, Next internals, brand files and anything with a file extension skip the proxy.
  matcher: ["/((?!api/|_next/|brand/|.*\\..*).*)"],
};
